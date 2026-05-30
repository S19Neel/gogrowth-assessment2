/**
 * GlowMist Landing Page — JavaScript
 * ====================================
 * Handles:
 *   1. FAQ Accordion (smooth open/close, single-open mode)
 *   2. AJAX Add to Cart (with loading state + error handling)
 *   3. Sticky Add to Cart Bar (IntersectionObserver)
 *   4. Quantity Selector (hero + sticky bar sync)
 *   5. Variant Selector (price update + variant ID swap)
 *   6. Smooth Scroll for anchor links
 *
 * Zero dependencies. Vanilla JS. Works on Shopify dev stores.
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     1. FAQ ACCORDION
     ═══════════════════════════════════════════════════════ */
  function initFaqAccordion() {
    var faqList = document.querySelector('[data-gm-faq-list]');
    if (!faqList) return;

    var items = faqList.querySelectorAll('[data-gm-faq-item]');

    items.forEach(function (item) {
      var toggle = item.querySelector('[data-gm-faq-toggle]');
      var content = item.querySelector('.gm-faq-item__content');
      if (!toggle || !content) return;

      toggle.addEventListener('click', function () {
        var isOpen = toggle.getAttribute('aria-expanded') === 'true';

        /* ── Close all other items (single-open mode) ─── */
        items.forEach(function (otherItem) {
          if (otherItem === item) return;
          var otherToggle = otherItem.querySelector('[data-gm-faq-toggle]');
          var otherContent = otherItem.querySelector('.gm-faq-item__content');
          if (!otherToggle || !otherContent) return;

          if (otherToggle.getAttribute('aria-expanded') === 'true') {
            otherContent.style.maxHeight = otherContent.scrollHeight + 'px';
            otherContent.offsetHeight; /* force reflow */
            otherContent.style.maxHeight = '0';
            otherToggle.setAttribute('aria-expanded', 'false');
            otherItem.classList.remove('is-open');
          }
        });

        if (isOpen) {
          /* ── Collapse ────────────────────────────────── */
          content.style.maxHeight = content.scrollHeight + 'px';
          content.offsetHeight; /* force reflow */
          content.style.maxHeight = '0';
          toggle.setAttribute('aria-expanded', 'false');
          item.classList.remove('is-open');
        } else {
          /* ── Expand ──────────────────────────────────── */
          content.style.maxHeight = content.scrollHeight + 'px';
          toggle.setAttribute('aria-expanded', 'true');
          item.classList.add('is-open');

          /* Remove inline max-height after transition so content can grow */
          content.addEventListener('transitionend', function onEnd(e) {
            if (e.propertyName !== 'max-height') return;
            content.removeEventListener('transitionend', onEnd);
            if (toggle.getAttribute('aria-expanded') === 'true') {
              content.style.maxHeight = 'none';
            }
          });
        }
      });
    });
  }


  /* ═══════════════════════════════════════════════════════
     2. AJAX ADD TO CART
     ═══════════════════════════════════════════════════════ */
  function addToCart(variantId, quantity, buttonEl) {
    if (!variantId) return;

    /* ── Loading state ────────────────────────────────── */
    buttonEl.classList.add('is-loading');
    buttonEl.disabled = true;

    /* Mock/Demo variant fallback for empty product preview */
    if (variantId === 'mock' || isNaN(parseInt(variantId, 10))) {
      setTimeout(function () {
        buttonEl.classList.remove('is-loading');
        buttonEl.disabled = false;
        showToast('success');
      }, 800);
      return;
    }

    var payload = {
      items: [{
        id: parseInt(variantId, 10),
        quantity: parseInt(quantity, 10) || 1
      }]
    };

    /* Locale-aware Shopify AJAX Cart URL routing */
    var rootPath = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    var url = rootPath.endsWith('/') ? (rootPath + 'cart/add.js') : (rootPath + '/cart/add.js');

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload)
    })
    .then(function (response) {
      if (!response.ok) {
        return response.json().then(function (data) {
          throw new Error(data.description || 'Could not add to cart');
        });
      }
      return response.json();
    })
    .then(function () {
      /* ── Success ─────────────────────────────────────── */
      buttonEl.classList.remove('is-loading');
      buttonEl.disabled = false;
      showToast('success');

      /* Try to open Taste theme's cart drawer if available */
      try {
        document.dispatchEvent(new CustomEvent('cart:open'));
      } catch (e) { /* silently fail */ }
    })
    .catch(function (error) {
      /* ── Error handling ──────────────────────────────── */
      buttonEl.classList.remove('is-loading');
      buttonEl.disabled = false;

      var errorMsg = document.getElementById('gm-toast-error-msg');
      if (errorMsg) {
        errorMsg.textContent = error.message || 'Something went wrong. Please try again.';
      }
      showToast('error');
    });
  }

  function showToast(type) {
    var toast = document.getElementById('gm-toast-' + type);
    if (!toast) return;

    toast.classList.add('is-visible');

    setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 3000);
  }

  function initAddToCart() {
    /* Hero Add to Cart */
    var heroBtn = document.querySelector('[data-gm-add-to-cart]');
    if (heroBtn) {
      heroBtn.addEventListener('click', function () {
        var variantId = heroBtn.getAttribute('data-variant-id');
        var qtyInput = document.querySelector('[data-gm-qty-value]');
        var quantity = qtyInput ? qtyInput.value : 1;
        addToCart(variantId, quantity, heroBtn);
      });
    }

    /* Sticky bar Add to Cart */
    var stickyBtn = document.querySelector('[data-gm-sticky-add-to-cart]');
    if (stickyBtn) {
      stickyBtn.addEventListener('click', function () {
        var variantId = stickyBtn.getAttribute('data-variant-id');
        var qtyInput = document.querySelector('[data-gm-sticky-qty-value]');
        var quantity = qtyInput ? qtyInput.value : 1;
        addToCart(variantId, quantity, stickyBtn);
      });
    }
  }


  /* ═══════════════════════════════════════════════════════
     3. STICKY ADD TO CART BAR
     ═══════════════════════════════════════════════════════ */
  function initStickyBar() {
    var heroSection = document.getElementById('gm-hero');
    var stickyBar = document.getElementById('gm-sticky-bar');
    if (!heroSection || !stickyBar) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          stickyBar.classList.remove('is-visible');
        } else {
          stickyBar.classList.add('is-visible');
        }
      });
    }, {
      root: null,
      threshold: 0,
      rootMargin: '0px'
    });

    observer.observe(heroSection);
  }


  /* ═══════════════════════════════════════════════════════
     4. QUANTITY SELECTOR
     ═══════════════════════════════════════════════════════ */
  function initQuantitySelector(containerSelector, valueSelector, minusSelector, plusSelector) {
    var container = document.querySelector(containerSelector);
    if (!container) return;

    var input = container.querySelector(valueSelector);
    var minus = container.querySelector(minusSelector);
    var plus = container.querySelector(plusSelector);
    if (!input || !minus || !plus) return;

    var min = parseInt(input.getAttribute('min'), 10) || 1;
    var max = parseInt(input.getAttribute('max'), 10) || 10;

    function updateButtons() {
      var val = parseInt(input.value, 10);
      minus.disabled = val <= min;
      plus.disabled = val >= max;
    }

    minus.addEventListener('click', function () {
      var val = parseInt(input.value, 10);
      if (val > min) {
        input.value = val - 1;
        updateButtons();
        syncQuantities(input);
      }
    });

    plus.addEventListener('click', function () {
      var val = parseInt(input.value, 10);
      if (val < max) {
        input.value = val + 1;
        updateButtons();
        syncQuantities(input);
      }
    });

    updateButtons();
  }

  /* Keep hero and sticky bar quantities in sync */
  function syncQuantities(source) {
    var heroQty = document.querySelector('[data-gm-qty-value]');
    var stickyQty = document.querySelector('[data-gm-sticky-qty-value]');
    if (!heroQty || !stickyQty) return;

    var value = source.value;
    if (source === heroQty) {
      stickyQty.value = value;
    } else {
      heroQty.value = value;
    }

    /* Update minus button disabled states */
    var heroMinus = document.querySelector('[data-gm-qty-minus]');
    var stickyMinus = document.querySelector('[data-gm-sticky-qty-minus]');
    var heroPlus = document.querySelector('[data-gm-qty-plus]');
    var stickyPlus = document.querySelector('[data-gm-sticky-qty-plus]');

    var val = parseInt(value, 10);
    if (heroMinus) heroMinus.disabled = val <= 1;
    if (stickyMinus) stickyMinus.disabled = val <= 1;
    if (heroPlus) heroPlus.disabled = val >= 10;
    if (stickyPlus) stickyPlus.disabled = val >= 10;
  }


  /* ═══════════════════════════════════════════════════════
     5. VARIANT SELECTOR
     ═══════════════════════════════════════════════════════ */
  function initVariantSelector() {
    var select = document.querySelector('[data-gm-variant-select]');
    if (!select) return;

    select.addEventListener('change', function () {
      var selectedOption = select.options[select.selectedIndex];
      var variantId = selectedOption.value;
      var price = selectedOption.getAttribute('data-price');

      /* Update price displays */
      var heroPrice = document.getElementById('gm-hero-price');
      var stickyPrice = document.getElementById('gm-sticky-price');
      if (heroPrice && price) heroPrice.textContent = price;
      if (stickyPrice && price) stickyPrice.textContent = price;

      /* Update variant ID on all Add to Cart buttons */
      var heroBtn = document.querySelector('[data-gm-add-to-cart]');
      var stickyBtn = document.querySelector('[data-gm-sticky-add-to-cart]');
      if (heroBtn) heroBtn.setAttribute('data-variant-id', variantId);
      if (stickyBtn) stickyBtn.setAttribute('data-variant-id', variantId);

      /* Enable/disable buttons based on availability */
      var isDisabled = selectedOption.disabled;
      if (heroBtn) {
        heroBtn.disabled = isDisabled;
        var heroText = heroBtn.querySelector('.gm-btn__text');
        if (heroText) heroText.textContent = isDisabled ? 'Sold Out' : 'Add to Cart';
      }
      if (stickyBtn) stickyBtn.disabled = isDisabled;
    });
  }


  /* ═══════════════════════════════════════════════════════
     6. SMOOTH SCROLL
     ═══════════════════════════════════════════════════════ */
  function initSmoothScroll() {
    var links = document.querySelectorAll('[data-gm-smooth-scroll]');
    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = link.getAttribute('href');
        if (!href || href.charAt(0) !== '#') return;

        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }


  /* ═══════════════════════════════════════════════════════
     7. CART DRAWER
     ═══════════════════════════════════════════════════════ */

  /* ── Helpers ──────────────────────────────────────────── */
  function getShopifyRoot() {
    return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  }

  function shopifyUrl(path) {
    var root = getShopifyRoot();
    return root.endsWith('/') ? (root + path) : (root + '/' + path);
  }

  /**
   * Format Shopify price (in cents/paise) to display string.
   * Shopify /cart.js returns prices in the shop's smallest
   * currency unit. For INR this is paise (1 rupee = 100 paise).
   */
  function formatMoney(paise) {
    var rupees = (paise / 100).toFixed(2);
    /* Remove trailing zeros: ₹999.00 → ₹999 */
    rupees = rupees.replace(/\.00$/, '');
    return '₹' + rupees;
  }

  /* ── DOM References (cached on init) ─────────────────── */
  var cartDrawer, cartOverlay, cartToggle, cartCountBadge;
  var cartItemsContainer, cartEmptyState, cartFooter;
  var cartSubtotal, drawerItemCount;
  var offerEl, offerText, offerProgress;

  function cacheCartDrawerElements() {
    cartDrawer         = document.getElementById('gm-cart-drawer');
    cartOverlay        = document.getElementById('gm-cart-overlay');
    cartToggle         = document.getElementById('gm-cart-toggle');
    cartCountBadge     = document.getElementById('gm-cart-count');
    cartItemsContainer = document.getElementById('gm-cart-items');
    cartEmptyState     = document.getElementById('gm-cart-empty');
    cartFooter         = document.getElementById('gm-cart-footer');
    cartSubtotal       = document.getElementById('gm-cart-subtotal');
    drawerItemCount    = document.getElementById('gm-drawer-item-count');
    offerEl            = document.getElementById('gm-cart-offer');
    offerText          = document.getElementById('gm-cart-offer-text');
    offerProgress      = document.getElementById('gm-cart-offer-progress');
  }

  /* ── Open / Close Drawer ─────────────────────────────── */
  function openCartDrawer() {
    if (!cartDrawer) return;
    cartDrawer.classList.add('is-open');
    cartOverlay.classList.add('is-open');
    cartToggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('gm-cart-open');
    fetchAndRenderCart();
  }

  function closeCartDrawer() {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('is-open');
    cartOverlay.classList.remove('is-open');
    cartToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('gm-cart-open');
  }

  /* ── Fetch Cart Data ─────────────────────────────────── */
  function fetchAndRenderCart() {
    fetch(shopifyUrl('cart.js'), {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(function (r) { return r.json(); })
    .then(function (cart) {
      renderCart(cart);
    })
    .catch(function () {
      /* If we can't fetch /cart.js (e.g. local preview),
         render an empty state so the drawer still works. */
      renderCart({ items: [], item_count: 0, total_price: 0 });
    });
  }

  /* ── Render Cart ─────────────────────────────────────── */
  function renderCart(cart) {
    var items = cart.items || [];
    var count = cart.item_count || 0;

    /* Update badge */
    updateCartBadge(count);

    /* Update header count */
    if (drawerItemCount) {
      drawerItemCount.textContent = '(' + count + (count === 1 ? ' item)' : ' items)');
    }

    /* Update offer progress */
    updateOfferProgress(count);

    if (items.length === 0) {
      /* Empty state */
      if (cartItemsContainer) cartItemsContainer.innerHTML = '';
      if (cartEmptyState) cartEmptyState.classList.add('is-visible');
      if (cartFooter) cartFooter.classList.remove('is-visible');
      return;
    }

    /* Has items */
    if (cartEmptyState) cartEmptyState.classList.remove('is-visible');
    if (cartFooter) cartFooter.classList.add('is-visible');

    /* Render line items */
    var html = '';
    items.forEach(function (item) {
      html += buildCartItemHTML(item);
    });
    if (cartItemsContainer) cartItemsContainer.innerHTML = html;

    /* Update subtotal */
    if (cartSubtotal) {
      cartSubtotal.textContent = formatMoney(cart.total_price);
    }

    /* Bind item event listeners */
    bindCartItemListeners();
  }

  /* ── Build HTML for a single cart line item ───────────── */
  function buildCartItemHTML(item) {
    var imageHtml;
    if (item.image) {
      imageHtml = '<img class="gm-cart-item__image" src="' + item.image + '" alt="' + escapeHtml(item.title) + '" loading="lazy" decoding="async">';
    } else {
      imageHtml = '<div class="gm-cart-item__image-placeholder">'
        + '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'
        + '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>'
        + '<circle cx="8.5" cy="8.5" r="1.5"/>'
        + '<polyline points="21 15 16 10 5 21"/>'
        + '</svg></div>';
    }

    var variantLabel = (item.variant_title && item.variant_title !== 'Default Title')
      ? '<span class="gm-cart-item__variant">' + escapeHtml(item.variant_title) + '</span>'
      : '';

    return '<div class="gm-cart-item" data-line-key="' + item.key + '">'
      + imageHtml
      + '<div class="gm-cart-item__details">'
        + '<span class="gm-cart-item__title">' + escapeHtml(item.product_title) + '</span>'
        + variantLabel
        + '<span class="gm-cart-item__price">' + formatMoney(item.line_price) + '</span>'
        + '<div class="gm-cart-item__actions">'
          + '<div class="gm-cart-item__qty">'
            + '<button type="button" class="gm-cart-item__qty-btn" data-gm-cart-minus="' + item.key + '" aria-label="Decrease quantity"' + (item.quantity <= 1 ? ' disabled' : '') + '>'
              + '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>'
            + '</button>'
            + '<input type="number" class="gm-cart-item__qty-val" value="' + item.quantity + '" min="1" max="10" readonly>'
            + '<button type="button" class="gm-cart-item__qty-btn" data-gm-cart-plus="' + item.key + '" aria-label="Increase quantity"' + (item.quantity >= 10 ? ' disabled' : '') + '>'
              + '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
            + '</button>'
          + '</div>'
          + '<button type="button" class="gm-cart-item__remove" data-gm-cart-remove="' + item.key + '" aria-label="Remove ' + escapeHtml(item.product_title) + '">'
            + '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
              + '<polyline points="3 6 5 6 21 6"/>'
              + '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
            + '</svg>'
          + '</button>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ── Bind +/- and Remove listeners on cart items ──────── */
  function bindCartItemListeners() {
    /* Plus buttons */
    document.querySelectorAll('[data-gm-cart-plus]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-gm-cart-plus');
        var input = btn.parentElement.querySelector('.gm-cart-item__qty-val');
        var qty = parseInt(input.value, 10) + 1;
        if (qty > 10) return;
        updateCartItem(key, qty);
      });
    });

    /* Minus buttons */
    document.querySelectorAll('[data-gm-cart-minus]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-gm-cart-minus');
        var input = btn.parentElement.querySelector('.gm-cart-item__qty-val');
        var qty = parseInt(input.value, 10) - 1;
        if (qty < 1) qty = 0; /* 0 = remove */
        updateCartItem(key, qty);
      });
    });

    /* Remove buttons */
    document.querySelectorAll('[data-gm-cart-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-gm-cart-remove');
        updateCartItem(key, 0);
      });
    });
  }

  /* ── Update a single cart item via /cart/change.js ────── */
  function updateCartItem(lineKey, quantity) {
    fetch(shopifyUrl('cart/change.js'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({ id: lineKey, quantity: quantity })
    })
    .then(function (r) { return r.json(); })
    .then(function (cart) {
      renderCart(cart);
    })
    .catch(function () {
      /* Fallback: re-fetch the full cart */
      fetchAndRenderCart();
    });
  }

  /* ── Update Badge Count with Bump Animation ──────────── */
  function updateCartBadge(count) {
    if (!cartCountBadge) return;
    var prev = parseInt(cartCountBadge.textContent, 10) || 0;
    cartCountBadge.textContent = count;
    cartCountBadge.setAttribute('data-count', count);

    if (count > prev) {
      cartCountBadge.classList.add('is-bumped');
      setTimeout(function () {
        cartCountBadge.classList.remove('is-bumped');
      }, 350);
    }
  }

  /* ── Buy 2 Get 1 Free — Offer Progress Tracker ───────── */
  function updateOfferProgress(totalItems) {
    if (!offerEl || !offerText || !offerProgress) return;

    var threshold = 2; /* Need at least 2 items to unlock the offer */

    if (totalItems >= threshold) {
      /* Offer unlocked! */
      offerEl.classList.add('is-unlocked');
      offerText.innerHTML = '🎉 <strong>Buy 2, Get 1 Free</strong> offer applied!';
      offerProgress.style.width = '100%';
    } else {
      /* Still in progress */
      offerEl.classList.remove('is-unlocked');
      var remaining = threshold - totalItems;
      offerText.innerHTML = 'Add <strong>' + remaining + ' more</strong> to unlock <strong>Buy 2, Get 1 Free!</strong>';
      var pct = Math.min(100, Math.round((totalItems / threshold) * 100));
      offerProgress.style.width = pct + '%';
    }
  }

  /* ── Init Cart Drawer ────────────────────────────────── */
  function initCartDrawer() {
    cacheCartDrawerElements();
    if (!cartDrawer || !cartToggle) return;

    /* Toggle button */
    cartToggle.addEventListener('click', function () {
      var isOpen = cartDrawer.classList.contains('is-open');
      if (isOpen) {
        closeCartDrawer();
      } else {
        openCartDrawer();
      }
    });

    /* Close button */
    var closeBtn = document.querySelector('[data-gm-cart-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeCartDrawer);
    }

    /* Overlay click to close */
    if (cartOverlay) {
      cartOverlay.addEventListener('click', closeCartDrawer);
    }

    /* Escape key to close */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && cartDrawer.classList.contains('is-open')) {
        closeCartDrawer();
      }
    });

    /* Listen for custom cart:open event (fired after Add to Cart success) */
    document.addEventListener('cart:open', function () {
      openCartDrawer();
    });

    /* Initial badge count fetch */
    fetch(shopifyUrl('cart.js'), {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(function (r) { return r.json(); })
    .then(function (cart) {
      updateCartBadge(cart.item_count || 0);
    })
    .catch(function () {
      updateCartBadge(0);
    });
  }


  /* ═══════════════════════════════════════════════════════
     INIT — Wait for DOM
     ═══════════════════════════════════════════════════════ */
  function init() {
    initFaqAccordion();
    initAddToCart();
    initStickyBar();
    initQuantitySelector('[data-gm-qty]', '[data-gm-qty-value]', '[data-gm-qty-minus]', '[data-gm-qty-plus]');
    initQuantitySelector('[data-gm-sticky-qty]', '[data-gm-sticky-qty-value]', '[data-gm-sticky-qty-minus]', '[data-gm-sticky-qty-plus]');
    initVariantSelector();
    initSmoothScroll();
    initCartDrawer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();


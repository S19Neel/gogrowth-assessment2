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

    var payload = {
      items: [{
        id: parseInt(variantId, 10),
        quantity: parseInt(quantity, 10) || 1
      }]
    };

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

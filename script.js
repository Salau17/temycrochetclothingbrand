// ===========================
//  CROCHETELO – script.js
//  With Auto Currency Detection
// ===========================
// ────────────────────────────────────────────
//  CURRENCY CONFIG
// ────────────────────────────────────────────
const CURRENCIES = {
  NGN: { symbol: '₦',  name: 'Nigerian Naira',    flag: '🇳🇬' },
  USD: { symbol: '$',  name: 'US Dollar',          flag: '🇺🇸' },
  GBP: { symbol: '£',  name: 'British Pound',      flag: '🇬🇧' },
  EUR: { symbol: '€',  name: 'Euro',               flag: '🇪🇺' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar',    flag: '🇨🇦' },
  GHS: { symbol: '₵',  name: 'Ghanaian Cedi',      flag: '🇬🇭' },
  KES: { symbol: 'KSh',name: 'Kenyan Shilling',    flag: '🇰🇪' },
  ZAR: { symbol: 'R',  name: 'South African Rand', flag: '🇿🇦' },
};

const COUNTRY_TO_CURRENCY = {
  NG: 'NGN', US: 'USD', GB: 'GBP', CA: 'CAD',
  AU: 'AUD', DE: 'EUR', FR: 'EUR', IT: 'EUR',
  ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR',
  GH: 'GHS', KE: 'KES', ZA: 'ZAR', UG: 'KES',
};

// ────────────────────────────────────────────

// Fallback rates (NGN base). Updated by live API when possible.
let rates = {
  NGN: 1, USD: 0.00063, GBP: 0.00050, EUR: 0.00058,
  CAD: 0.00086, GHS: 0.0077, KES: 0.082, ZAR: 0.012,
};

let currentCurrency = 'NGN';


// ── 1. Fetch live exchange rates ──
async function fetchRates() {
  try {
    const res  = await fetch('https://api.exchangerate-api.com/v4/latest/NGN');
    const data = await res.json();
    if (data && data.rates) {
      Object.keys(CURRENCIES).forEach(code => {
        if (data.rates[code]) rates[code] = data.rates[code];
      });
    }
  } catch (e) { /* use fallback rates */ }
}

// ── 2. Auto-detect visitor country ──
async function detectCountry() {
  try {
    const res  = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    return COUNTRY_TO_CURRENCY[data.country_code] || 'NGN';
  } catch (e) { return 'NGN'; }
}

// ── 3. Convert & display prices ──
function normalizeNgnPrice(value) {
  const cleaned = value.trim().replace(/[^0-9.,]/g, '');
  const normalized = cleaned.replace(/,/g, '');
  const amount = parseFloat(normalized) || 0;
  const precision = normalized.includes('.') ? normalized.split('.')[1].length : 0;
  return { amount, precision };
}

function convertPrice(ngnAmount, toCurrency, precision = 0) {
  const converted = ngnAmount * (rates[toCurrency] || 1);
  if (toCurrency === 'NGN') {
    return converted.toLocaleString('en-NG', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }
  const digits = converted >= 1000 ? 0 : 2;
  return converted.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function updateAllPrices(code) {
  const currency = CURRENCIES[code];
  if (!currency) return;
  document.querySelectorAll('.price').forEach(el => {
    const original = el.dataset.originalPrice || el.textContent;
    if (!el.dataset.ngnPrice) {
      const { amount, precision } = normalizeNgnPrice(original);
      el.dataset.ngnPrice = amount;
      el.dataset.ngnPrecision = precision;
      el.dataset.originalPrice = original;
    }
    const precision = parseInt(el.dataset.ngnPrecision, 10) || 0;
    el.textContent = `${currency.symbol} ${convertPrice(parseFloat(el.dataset.ngnPrice), code, precision)}`;
  });
  currentCurrency = code;
  document.querySelectorAll('.currency-switcher-btn').forEach(btn => {
    btn.innerHTML = `${currency.flag} ${code} <span class="arrow">▼</span>`;
  });
}

// ── 4. Build dropdown ──
function injectCurrencySwitchers() {
  document.querySelectorAll('.currency-switcher-btn').forEach(btn => {
    if (btn.dataset.upgraded) return;
    btn.dataset.upgraded = 'true';
    const wrapper = document.createElement('div');
    wrapper.className = 'currency-wrapper';
    btn.parentNode.insertBefore(wrapper, btn);
    wrapper.appendChild(btn);

    // build dropdown using DOM nodes to avoid HTML parsing edge-cases
    const dd = document.createElement('div');
    dd.className = 'currency-dropdown';
    Object.entries(CURRENCIES).forEach(([code, info]) => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'currency-option';
      opt.dataset.code = code;
      opt.innerHTML = `<span>${info.flag}</span><span class="code">${code}</span><span class="cname">${info.name}</span>`;
      dd.appendChild(opt);
    });
    wrapper.appendChild(dd);

    // toggle dropdown
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dd.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) dd.classList.add('open');
    });

    // delegate clicks from dropdown to handle selection
    dd.addEventListener('click', (e) => {
      e.stopPropagation();
      const opt = e.target.closest('.currency-option');
      if (!opt) return;
      const code = opt.dataset.code;
      updateAllPrices(code);
      closeAllDropdowns();
      try { localStorage.setItem('preferredCurrency', code); } catch (err) {}
    });
  });
}

function closeAllDropdowns() {
  document.querySelectorAll('.currency-dropdown').forEach(d => d.classList.remove('open'));
}

// only close dropdowns when clicking outside currency wrapper or mobile menu
document.addEventListener('click', (e) => {
  if (e.target.closest('.currency-wrapper')) return;
  if (e.target.closest('#mobileMenu')) return;
  closeAllDropdowns();
});

// ── 5. Toast notification ──
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'currency-toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 100);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 4000);
}

// ── 6. Init ──
async function initCurrency() {
  await fetchRates();
  const saved = localStorage.getItem('preferredCurrency');
  const isLocalPreview = location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  // When previewing locally, ignore any previously saved preference to ensure NGN shows up in dev.
  const target = isLocalPreview
    ? 'NGN'
    : ((saved && CURRENCIES[saved]) ? saved : await detectCountry());
  injectCurrencySwitchers();
  updateAllPrices(target);
  if (target !== 'NGN') showToast(`Prices shown in ${CURRENCIES[target].name} (${target})`);
}


document.addEventListener('DOMContentLoaded', () => {
  initCurrency();

  // ── Mobile Menu ──
  const menuToggle = document.getElementById('menuToggle');
  const closeMenu  = document.getElementById('closeMenu');
  const mobileMenu = document.getElementById('mobileMenu');
  menuToggle?.addEventListener('click', () => mobileMenu.classList.add('open'));
  closeMenu?.addEventListener('click',  () => mobileMenu.classList.remove('open'));
  document.addEventListener('click', (e) => {
    if (mobileMenu?.classList.contains('open') &&
        !mobileMenu.contains(e.target) && !menuToggle.contains(e.target)) {
      mobileMenu.classList.remove('open');
    }
  });

  // ── Product Filter Tabs ──
  const tabs  = document.querySelectorAll('.tab');
  const cards = document.querySelectorAll('.product-card');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;
      cards.forEach(card => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.style.display   = show ? 'block' : 'none';
        card.style.animation = show ? 'fadeIn 0.3s ease' : '';
      });
    });
  });

  // ── Wishlist Toggle ──
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const filled = btn.textContent === '♥';
      btn.textContent = filled ? '♡' : '♥';
      btn.style.background = filled ? '' : '#c0392b';
    });
  });

  // ── Cart state + UI ──
  const cartCountEl = document.querySelector('.cart-count');
  let cart = JSON.parse(localStorage.getItem('siteCart') || '{}');
  function saveCart() { try { localStorage.setItem('siteCart', JSON.stringify(cart)); } catch (e) {} }
  function cartTotalCount() { return Object.values(cart).reduce((s, it) => s + it.qty, 0); }
  function formatForDisplay(amount, precision = 0) {
    return `${CURRENCIES[currentCurrency]?.symbol || ''} ${convertPrice(amount, currentCurrency, precision)}`;
  }

  // render mini cart drawer
  function ensureCartDrawer() {
    let drawer = document.querySelector('.mini-cart');
    if (drawer) return drawer;
    drawer = document.createElement('aside');
    drawer.className = 'mini-cart';
    drawer.innerHTML = `<div class="mini-cart-inner"><button class="mini-cart-close">✕</button><h3>Your Cart</h3><div class="mini-cart-items"></div><div class="mini-cart-footer"><div class="mini-cart-total"></div><a class="mini-cart-checkout" href="checkout.html">Checkout</a></div></div>`;
    document.body.appendChild(drawer);
    drawer.querySelector('.mini-cart-close').addEventListener('click', () => drawer.classList.remove('open'));
    return drawer;
  }

  function renderCart() {
    const drawer = ensureCartDrawer();
    const list = drawer.querySelector('.mini-cart-items');
    list.innerHTML = '';
    let totalNgn = 0;
    const items = Object.entries(cart);
    if (!items.length) {
      list.innerHTML = '<p class="mini-cart-empty">Your cart is empty.</p>';
    }
    items.forEach(([key, item]) => {
      const row = document.createElement('div');
      row.className = 'mini-cart-row';
      const itemTotal = item.price * item.qty;
      totalNgn += itemTotal;
      row.innerHTML = `<div class="mini-cart-thumb-wrap"><img src="${item.img || ''}" alt="${item.name}" class="mini-cart-thumb" loading="lazy"/></div><div class="r-left"><strong>${item.name}</strong><div class="mini-cart-controls"><button type="button" class="qty-btn minus" data-key="${key}">-</button><span>${item.qty}</span><button type="button" class="qty-btn plus" data-key="${key}">+</button></div></div><div class="r-right"><span>${formatForDisplay(item.price, item.precision)}</span><div class="line-total">${formatForDisplay(itemTotal, item.precision)}</div></div>`;
      list.appendChild(row);
    });
    drawer.querySelector('.mini-cart-total').textContent = `Total: ${formatForDisplay(totalNgn, 2)}`;
    if (cartCountEl) cartCountEl.textContent = cartTotalCount();
    saveCart();
  }

  function changeItemQty(key, delta) {
    if (!cart[key]) return;
    cart[key].qty += delta;
    if (cart[key].qty <= 0) {
      delete cart[key];
    }
    renderCart();
    renderCartPage();
  }

  function renderCartPage() {
    const pageContainer = document.getElementById('cartItems');
    if (!pageContainer) return;
    pageContainer.innerHTML = '';
    let totalNgn = 0;
    const items = Object.entries(cart);
    if (!items.length) {
      pageContainer.innerHTML = '<p class="cart-page-empty">Your cart is empty. Add an item from the shop to get started.</p>';
      const totalEl = document.getElementById('cartPageTotal');
      if (totalEl) totalEl.textContent = `Total: ${formatForDisplay(0, 2)}`;
      if (cartCountEl) cartCountEl.textContent = cartTotalCount();
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'cart-page-grid';
    items.forEach(([key, item]) => {
      const row = document.createElement('div');
      row.className = 'cart-page-row';
      const itemTotal = item.price * item.qty;
      totalNgn += itemTotal;
      row.innerHTML = `
        <div class="cart-page-thumb"><img src="${item.img || ''}" alt="${item.name}" /></div>
        <div class="cart-page-details">
          <h3>${item.name}</h3>
          <div class="cart-page-controls"><button type="button" class="qty-btn minus" data-key="${key}">-</button><span>${item.qty}</span><button type="button" class="qty-btn plus" data-key="${key}">+</button></div>
          <p>${formatForDisplay(item.price, item.precision)}</p>
        </div>
        <div class="cart-page-price">${formatForDisplay(itemTotal, item.precision)}</div>
      `;
      grid.appendChild(row);
    });
    pageContainer.appendChild(grid);
    const totalEl = document.getElementById('cartPageTotal');
    if (totalEl) totalEl.textContent = `Total: ${formatForDisplay(totalNgn, 2)}`;
    if (cartCountEl) cartCountEl.textContent = cartTotalCount();
  }

  function toggleCart() {
    const drawer = ensureCartDrawer();
    drawer.classList.toggle('open');
    renderCart();
  }

  // add-to-cart by clicking product card (excluding inner controls)
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.wishlist-btn') || e.target.closest('button')) return;
      // open product details modal instead of immediate add
      openProductModalFromCard(card);
    });
  });

  // Product modal handling
  function openProductModalFromCard(card) {
    const modal = document.getElementById('productModal');
    if (!modal) return;
    const title = card.querySelector('h3')?.textContent?.trim() || 'Item';
    const subtitle = card.querySelector('.product-subtitle')?.textContent?.trim() || '';
    const priceEl = card.querySelector('.price');
    const original = priceEl?.dataset.originalPrice || priceEl?.textContent || '';
    const { amount, precision } = normalizeNgnPrice(original);
    // prefer the relative src attribute so stored image paths remain portable
    const imgSrc = card.querySelector('img')?.getAttribute('src') || '';
    const imgAlt = card.querySelector('img')?.alt || title;

    modal.querySelector('.modal-title').textContent = title;
    modal.querySelector('.modal-subtitle').textContent = subtitle;
    modal.querySelector('.modal-price').textContent = `${CURRENCIES[currentCurrency]?.symbol || ''} ${convertPrice(amount, currentCurrency, precision)}`;
    modal.querySelector('.modal-desc').textContent = subtitle || 'Handmade crochet item. Select quantity and add to cart.';
    modal.querySelector('.product-modal-thumb img').src = imgSrc;
    modal.querySelector('.product-modal-thumb img').alt = imgAlt;

    // store product data on modal for adding to cart
    modal.dataset.name = title;
    modal.dataset.price = amount;
    modal.dataset.precision = precision;
    modal.dataset.img = imgSrc;

    const qtyInput = modal.querySelector('.modal-qty'); if (qtyInput) qtyInput.value = 1;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  // modal close and backdrop
  document.body.addEventListener('click', (e) => {
    const modal = document.getElementById('productModal');
    if (!modal) return;
    if (e.target.closest('[data-close]')) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  // handle add-to-cart from modal
  document.querySelectorAll('.modal-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('#productModal');
      if (!modal) return;
      const name = modal.dataset.name || 'Item';
      const price = parseFloat(modal.dataset.price) || 0;
      const precision = parseInt(modal.dataset.precision, 10) || 0;
      const imgSrc = modal.dataset.img || '';
      const qty = parseInt(modal.querySelector('.modal-qty')?.value || '1', 10) || 1;
      const key = name.replace(/\s+/g, '_').toLowerCase();
      if (!cart[key]) cart[key] = { name, price, precision, qty: 0, img: imgSrc };
      cart[key].qty += qty;
      renderCart();
      renderCartPage();
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    });
  });

  // open cart when clicking cart button
  document.querySelectorAll('.cart-btn').forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleCart(); }));

  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;
    const key = btn.dataset.key;
    const delta = btn.classList.contains('plus') ? 1 : -1;
    changeItemQty(key, delta);
  });

  // render cart page if present and update cart count badge
  renderCartPage();
  if (cartCountEl) cartCountEl.textContent = cartTotalCount();

  // ── Fade-in on scroll ──
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity   = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.product-card, .hero-content, .see-more-inner').forEach(el => {
    el.style.opacity    = '0';
    el.style.transform  = 'translateY(24px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
});

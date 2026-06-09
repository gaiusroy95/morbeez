/**
 * Morbeez farmer customer portal — simple mobile dashboard (no CRM).
 */
(function () {
  var cfg = window.MORBEEZ_PORTAL || {};
  var authCfg = window.MORBEEZ_AUTH || {};
  var apiBase = (cfg.apiBase || authCfg.apiBase || '').replace(/\/$/, '');
  var TOKEN_KEY = (window.MorbeezCart && window.MorbeezCart.TOKEN_KEY) || 'morbeez_farmer_token';

  var state = {
    tab: 'home',
    summary: null,
    orders: null,
    advisory: null,
    reports: null,
    roi: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inr(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function badgeTone(tone) {
    var map = {
      success: 'success',
      warning: 'warning',
      info: 'info',
      danger: 'danger',
      good: 'good',
      monitor: 'monitor',
      critical: 'critical',
    };
    return map[tone] || 'info';
  }

  function badge(label, tone) {
    return (
      '<span class="morbeez-portal__badge morbeez-portal__badge--' +
      badgeTone(tone) +
      '">' +
      esc(label) +
      '</span>'
    );
  }

  function waUrl(msg) {
    var phone = String(cfg.whatsappPhone || '917676026318').replace(/\D/g, '');
    var text = encodeURIComponent(msg || cfg.whatsappMessage || 'Hi Morbeez');
    return 'https://wa.me/' + phone + '?text=' + text;
  }

  function api(path, options) {
    var token = getToken();
    var headers = { Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (options && options.body) headers['Content-Type'] = 'application/json';
    return fetch(apiBase + path, Object.assign({ headers: headers, credentials: 'omit' }, options || {})).then(
      function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
          return data;
        });
      }
    );
  }

  function showError(msg) {
    var el = $('portal-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError() {
    var el = $('portal-error');
    if (el) el.classList.add('hidden');
  }

  function setTab(name) {
    state.tab = name;
    document.querySelectorAll('[data-portal-tab]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-portal-tab') === name);
    });
    document.querySelectorAll('[data-portal-panel]').forEach(function (panel) {
      panel.classList.toggle('is-active', panel.getAttribute('data-portal-panel') === name);
    });
    if (name === 'orders' && !state.orders) loadOrders();
    if (name === 'advisory' && !state.advisory) loadAdvisory();
    if (name === 'reports' && !state.reports) loadReports();
    if (name === 'support' && !state.roi) loadRoi();
  }

  function renderHome() {
    var s = state.summary;
    if (!s) return;
    var crop = s.crop;
    var addr = s.shippingAddress || {};
    var glance = s.atAGlance || {};
    var rec = s.latestRecommendation;
    var ord = s.recentOrder;

    var cropPills = '';
    if (crop) {
      cropPills +=
        '<span class="morbeez-portal__crop-pill">🌿 ' +
        esc(crop.name) +
        (crop.variety ? ' ' + esc(crop.variety) : '') +
        '</span>';
      if (crop.fieldSize) cropPills += '<span class="morbeez-portal__crop-pill">📐 ' + esc(crop.fieldSize) + '</span>';
      if (crop.stage) cropPills += '<span class="morbeez-portal__crop-pill">📈 ' + esc(crop.stage) + '</span>';
    }

    var bullets = '';
    if (rec && rec.bullets && rec.bullets.length) {
      bullets = '<ul class="morbeez-portal__list">' + rec.bullets.map(function (b) {
        return '<li>' + esc(b) + '</li>';
      }).join('') + '</ul>';
    } else if (rec && rec.summary) {
      bullets = '<p class="text-sm text-[var(--color-muted)]">' + esc(rec.summary) + '</p>';
    }

    var orderHtml = '';
    if (ord) {
      orderHtml =
        '<div class="morbeez-portal__order-row morbeez-portal__order-row--clickable" data-order-track="' +
        esc(ord.id) +
        '" role="button" tabindex="0" aria-label="View tracking for ' +
        esc(ord.orderNumber) +
        '">' +
        (ord.productImageUrl
          ? '<img class="morbeez-portal__order-img" src="' + esc(ord.productImageUrl) + '" alt="" />'
          : '<div class="morbeez-portal__order-img"></div>') +
        '<div class="flex-1 min-w-0">' +
        '<p class="font-bold text-sm">' +
        esc(ord.productTitle) +
        '</p>' +
        '<p class="mt-1">' +
        badge(ord.statusLabel, ord.statusTone) +
        '</p>' +
        '<p class="text-xs text-[var(--color-muted)] mt-1">' +
        esc(ord.orderNumber) +
        ' · ' +
        esc(ord.deliveredOn || ord.orderedOn) +
        '</p>' +
        '<p class="text-xs text-[var(--color-primary)] font-semibold mt-2">Tap for tracking' +
        (ord.status === 'delivered' ? ' &amp; review' : '') +
        ' →</p>' +
        '<button type="button" class="morbeez-btn-secondary mt-3 text-sm py-2 px-4" data-reorder="' +
        esc(ord.productTitle) +
        '">Order again</button>' +
        '</div></div>';
    } else {
      orderHtml = '<p class="morbeez-portal__empty">No orders yet. <a href="' + esc(cfg.shopUrl) + '">Shop products</a></p>';
    }

    $('panel-home').innerHTML =
      '<div class="morbeez-portal__hero">' +
      '<div>' +
      '<h1 class="morbeez-portal__greeting">Hello ' +
      esc(s.greetingName) +
      ' 👋</h1>' +
      '<p class="morbeez-portal__sub">Welcome to your Morbeez Dashboard</p>' +
      (cropPills ? '<div class="morbeez-portal__crop-strip">' + cropPills + '</div>' : '') +
      '</div>' +
      '<div class="morbeez-portal__banner-card">' +
      '<p class="text-sm font-semibold opacity-90">Good day to grow!</p>' +
      '<p class="text-xs mt-1 opacity-80">Stay consistent with nutrition and crop protection.</p>' +
      '</div></div>' +

      '<div class="morbeez-portal__quick-grid mt-2">' +
      '<button type="button" class="morbeez-portal__quick-card morbeez-portal__quick-card--orders" data-go-tab="orders">' +
      '<div class="morbeez-portal__quick-title">Orders</div>' +
      '<div class="morbeez-portal__quick-desc">Track orders &amp; deliveries</div>' +
      '<span class="morbeez-portal__quick-link">View orders →</span></button>' +
      '<button type="button" class="morbeez-portal__quick-card morbeez-portal__quick-card--advisory" data-go-tab="advisory">' +
      '<div class="morbeez-portal__quick-title">Advisory</div>' +
      '<div class="morbeez-portal__quick-desc">Today\'s crop recommendation</div>' +
      '<span class="morbeez-portal__quick-link">View advisory →</span></button>' +
      '<button type="button" class="morbeez-portal__quick-card morbeez-portal__quick-card--reports" data-go-tab="reports">' +
      '<div class="morbeez-portal__quick-title">Reports</div>' +
      '<div class="morbeez-portal__quick-desc">Soil &amp; crop reports</div>' +
      '<span class="morbeez-portal__quick-link">View reports →</span></button>' +
      '<button type="button" class="morbeez-portal__quick-card morbeez-portal__quick-card--roi" data-go-tab="support">' +
      '<div class="morbeez-portal__quick-title">ROI</div>' +
      '<div class="morbeez-portal__quick-desc">Estimate your farm profit</div>' +
      '<span class="morbeez-portal__quick-link">View ROI →</span></button>' +
      '</div>' +

      '<div class="morbeez-portal__card">' +
      '<h2 class="morbeez-portal__section-title">Shipping address</h2>' +
      '<p class="font-bold">' +
      esc(addr.name) +
      (addr.verified ? ' ✓' : '') +
      '</p>' +
      '<div class="morbeez-portal__address-lines mt-2">' +
      (addr.lines || []).map(function (l) {
        return '<div>' + esc(l) + '</div>';
      }).join('') +
      (addr.phone ? '<div class="mt-1">' + esc(addr.phone) + '</div>' : '') +
      '</div>' +
      '<div class="flex flex-wrap gap-2 mt-4">' +
      '<button type="button" class="morbeez-btn-secondary text-sm py-2 px-4" id="portal-edit-address">Edit address</button>' +
      '<button type="button" class="morbeez-btn-primary text-sm py-2 px-4" id="portal-add-address">Add address</button>' +
      '</div></div>' +

      '<div><h2 class="morbeez-portal__section-title">At a glance</h2>' +
      '<div class="morbeez-portal__glance-row">' +
      '<div class="morbeez-portal__glance"><div class="morbeez-portal__glance-value">' +
      esc(glance.activeOrders) +
      '</div><div class="morbeez-portal__glance-label">Active orders</div></div>' +
      '<div class="morbeez-portal__glance"><div class="morbeez-portal__glance-value text-base">' +
      esc(glance.nextAdvisory) +
      '</div><div class="morbeez-portal__glance-label">' +
      esc(glance.nextAdvisoryHint || 'Next advisory') +
      '</div></div>' +
      '<div class="morbeez-portal__glance"><div class="morbeez-portal__glance-value">' +
      esc(glance.newReports) +
      '</div><div class="morbeez-portal__glance-label">New reports</div></div>' +
      '<div class="morbeez-portal__glance"><div class="morbeez-portal__glance-value">' +
      inr(glance.estimatedProfitInr) +
      '</div><div class="morbeez-portal__glance-label">Est. profit</div></div>' +
      '</div></div>' +

      '<div class="grid gap-4 lg:grid-cols-2">' +
      '<div class="morbeez-portal__card">' +
      '<h2 class="morbeez-portal__section-title">Today\'s recommendation</h2>' +
      (rec
        ? '<p class="text-xs text-[var(--color-muted)]">' +
          esc(rec.cropName) +
          (rec.stage ? ' · ' + esc(rec.stage) : '') +
          (rec.dayLabel ? ' · ' + esc(rec.dayLabel) : '') +
          '</p>' +
          bullets +
          '<button type="button" class="morbeez-btn-primary mt-4 w-full" data-go-tab="advisory">View full advisory →</button>'
        : '<p class="morbeez-portal__empty">Recommendations appear here after your agronomist visit or WhatsApp advisory.</p>') +
      '</div>' +
      '<div class="morbeez-portal__card">' +
      '<h2 class="morbeez-portal__section-title">Recent order</h2>' +
      orderHtml +
      '</div></div>' +

      '<div class="morbeez-portal__card" id="portal-upload-card">' +
      '<h2 class="morbeez-portal__section-title">Upload field photo</h2>' +
      '<p class="text-sm text-[var(--color-muted)] mb-3">Get expert analysis of your crop — field, leaf or rhizome.</p>' +
      '<div class="flex flex-wrap gap-2 mb-3">' +
      ['field', 'leaf', 'rhizome'].map(function (t) {
        return (
          '<label class="morbeez-btn-secondary text-sm py-2 px-3 cursor-pointer">' +
          '<input type="radio" name="photo-type" value="' +
          t +
          '" class="morbeez-portal__hidden-input" ' +
          (t === 'field' ? 'checked' : '') +
          ' /> ' +
          (t === 'field' ? 'Full field' : t === 'leaf' ? 'Leaf close-up' : 'Rhizome issue') +
          '</label>'
        );
      }).join('') +
      '</div>' +
      '<div class="morbeez-portal__upload-zone" id="portal-upload-zone" tabindex="0" role="button">' +
      '<p class="font-semibold">📷 Upload photo</p>' +
      '<p class="text-xs text-[var(--color-muted)] mt-1">Tap or drag — JPG, PNG up to 8MB</p>' +
      '</div>' +
      '<input type="file" id="portal-file-input" accept="image/jpeg,image/png,image/webp" class="morbeez-portal__hidden-input" />' +
      '<p id="portal-upload-status" class="text-sm mt-2 hidden"></p>' +
      '</div>' +

      '<div class="morbeez-portal__support-banner">' +
      '<p class="font-bold">Need help? Chat with our agronomist on WhatsApp</p>' +
      '<a href="' +
      waUrl() +
      '" target="_blank" rel="noopener" class="morbeez-btn-whatsapp mt-3 inline-flex w-full justify-center">Chat on WhatsApp</a>' +
      '</div>' +

      '<div class="morbeez-portal__footer-trust">' +
      '<div class="morbeez-portal__trust-item"><strong>Expert guidance</strong>Crop-wise recommendations</div>' +
      '<div class="morbeez-portal__trust-item"><strong>Quality products</strong>Trusted by farmers</div>' +
      '<div class="morbeez-portal__trust-item"><strong>On-time delivery</strong>Fast &amp; safe shipping</div>' +
      '<div class="morbeez-portal__trust-item"><strong>Always here</strong>WhatsApp support</div>' +
      '</div>';

    bindHomeEvents();
  }

  function closeAddressModal() {
    var modal = $('portal-address-modal');
    if (modal) modal.remove();
    document.body.classList.remove('morbeez-portal--modal-open');
  }

  function showAddressModal(mode) {
    closeAddressModal();
    var isAdd = mode === 'add';
    var overlay = document.createElement('div');
    overlay.id = 'portal-address-modal';
    overlay.className = 'morbeez-portal__modal-backdrop';
    overlay.innerHTML =
      '<div class="morbeez-portal__modal" role="dialog" aria-modal="true" aria-labelledby="portal-address-title">' +
      '<h2 id="portal-address-title" class="morbeez-portal__modal-title">' +
      (isAdd ? 'Add delivery address' : 'Edit delivery address') +
      '</h2>' +
      '<p class="morbeez-portal__modal-sub">Used for order delivery and checkout.</p>' +
      '<form id="portal-address-form" class="morbeez-portal__address-form">' +
      '<label class="morbeez-portal__field"><span>Street / house no.</span>' +
      '<input type="text" id="portal-addr-line1" name="address1" required maxlength="240" autocomplete="address-line1" placeholder="e.g. Sulthan Bathery, Main Road" /></label>' +
      '<label class="morbeez-portal__field"><span>Area / landmark <em>(optional)</em></span>' +
      '<input type="text" id="portal-addr-line2" name="address2" maxlength="120" autocomplete="address-line2" placeholder="Near bus stand" /></label>' +
      '<label class="morbeez-portal__field"><span>City / district</span>' +
      '<input type="text" id="portal-addr-city" name="city" required maxlength="80" autocomplete="address-level2" placeholder="Wayanad" /></label>' +
      '<label class="morbeez-portal__field"><span>State</span>' +
      '<input type="text" id="portal-addr-state" name="state" required maxlength="80" autocomplete="address-level1" placeholder="Kerala" /></label>' +
      '<label class="morbeez-portal__field"><span>PIN code</span>' +
      '<input type="text" id="portal-addr-pin" name="pincode" required maxlength="6" inputmode="numeric" pattern="[0-9]{6}" autocomplete="postal-code" placeholder="673592" /></label>' +
      '<p id="portal-address-form-error" class="morbeez-portal__form-error hidden"></p>' +
      '<div class="morbeez-portal__modal-actions">' +
      '<button type="button" class="morbeez-btn-secondary text-sm py-2 px-4" id="portal-address-cancel">Cancel</button>' +
      '<button type="submit" class="morbeez-btn-primary text-sm py-2 px-4" id="portal-address-save">' +
      (isAdd ? 'Save address' : 'Update address') +
      '</button></div></form></div>';
    document.body.appendChild(overlay);
    document.body.classList.add('morbeez-portal--modal-open');

    var form = $('portal-address-form');
    var formError = $('portal-address-form-error');
    var saveBtn = $('portal-address-save');

    function setFormError(msg) {
      if (!formError) return;
      if (msg) {
        formError.textContent = msg;
        formError.classList.remove('hidden');
      } else {
        formError.textContent = '';
        formError.classList.add('hidden');
      }
    }

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeAddressModal();
    });
    $('portal-address-cancel').addEventListener('click', closeAddressModal);

    if (!isAdd) {
      api('/api/v1/farmer/portal/profile')
        .then(function (res) {
          var p = res.profile || {};
          $('portal-addr-line1').value = p.shippingAddress || '';
          $('portal-addr-city').value = p.district || '';
          $('portal-addr-state').value = p.state || '';
          $('portal-addr-pin').value = p.deliveryPincode || p.pincode || '';
        })
        .catch(function (e) {
          setFormError(e.message);
        });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      setFormError('');
      var address1 = ($('portal-addr-line1').value || '').trim();
      var address2 = ($('portal-addr-line2').value || '').trim();
      var city = ($('portal-addr-city').value || '').trim();
      var state = ($('portal-addr-state').value || '').trim();
      var pincode = ($('portal-addr-pin').value || '').replace(/\D/g, '').slice(0, 6);
      if (!address1) {
        setFormError('Please enter your street address.');
        return;
      }
      if (!city || !state) {
        setFormError('Please enter city and state.');
        return;
      }
      if (pincode.length !== 6) {
        setFormError('Please enter a valid 6-digit PIN code.');
        return;
      }
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
      }
      api('/api/v1/farmer/portal/address', {
        method: 'PATCH',
        body: JSON.stringify({
          address1: address1,
          address2: address2 || undefined,
          city: city,
          state: state,
          pincode: pincode,
        }),
      })
        .then(function () {
          closeAddressModal();
          hideError();
          return loadSummary();
        })
        .catch(function (err) {
          setFormError(err.message);
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = isAdd ? 'Save address' : 'Update address';
          }
        });
    });

    setTimeout(function () {
      var first = $('portal-addr-line1');
      if (first) first.focus();
    }, 50);
  }

  function bindHomeEvents() {
    document.querySelectorAll('[data-go-tab]').forEach(function (el) {
      el.addEventListener('click', function () {
        setTab(el.getAttribute('data-go-tab'));
      });
    });
    document.querySelectorAll('[data-reorder]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var q = encodeURIComponent(btn.getAttribute('data-reorder') || '');
        window.location.href = (cfg.searchUrl || '/search') + '?q=' + q;
      });
    });
    var editBtn = $('portal-edit-address');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        showAddressModal('edit');
      });
    }
    var addBtn = $('portal-add-address');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        showAddressModal('add');
      });
    }
    bindOrderTrackingClicks($('panel-home'));
    bindUpload();
  }

  function renderStarButtons(productKey, selected) {
    var html = '<div class="morbeez-portal__stars" data-stars-for="' + esc(productKey) + '" role="radiogroup" aria-label="Rate product">';
    for (var s = 1; s <= 5; s++) {
      html +=
        '<button type="button" class="morbeez-portal__star' +
        (selected >= s ? ' is-on' : '') +
        '" data-star="' +
        s +
        '" aria-label="' +
        s +
        ' star' +
        (s > 1 ? 's' : '') +
        '">★</button>';
    }
    html += '<input type="hidden" class="morbeez-portal__star-value" value="' + (selected || 0) + '" /></div>';
    return html;
  }

  function renderReviewSection(orderId, canReview, reviewLines) {
    if (!canReview || !reviewLines || !reviewLines.length) return '';
    var cards = reviewLines
      .map(function (line) {
        if (line.review) {
          return (
            '<div class="morbeez-portal__review-card is-done">' +
            '<p class="font-semibold text-sm">🛍 Rate the product · ' +
            esc(line.title) +
            '</p>' +
            '<div class="morbeez-portal__stars is-readonly" aria-label="' +
            esc(line.review.rating) +
            ' stars">' +
            '★★★★★'.slice(0, line.review.rating) +
            '☆☆☆☆☆'.slice(line.review.rating) +
            '</div>' +
            (line.review.reviewText
              ? '<p class="text-sm mt-2 text-[var(--color-trust)]">' + esc(line.review.reviewText) + '</p>'
              : '') +
            '<p class="text-xs text-[var(--color-muted)] mt-2">Thanks for your review!</p>' +
            '</div>'
          );
        }
        return (
          '<form class="morbeez-portal__review-card morbeez-portal__review-form" data-review-form data-order-id="' +
          esc(orderId) +
          '" data-product-key="' +
          esc(line.productKey) +
          '">' +
          '<p class="font-semibold text-sm">🛍 Rate the product · ' +
          esc(line.title) +
          '</p>' +
          renderStarButtons(line.productKey, 0) +
          '<label class="morbeez-portal__field mt-3"><span>Your feedback <em>(optional)</em></span>' +
          '<textarea rows="3" maxlength="2000" class="morbeez-portal__review-text" placeholder="How did this product work on your farm?"></textarea></label>' +
          '<p class="morbeez-portal__form-error hidden morbeez-portal__review-error"></p>' +
          '<button type="submit" class="morbeez-btn-primary text-sm py-2 px-4 mt-2">Submit review</button>' +
          '</form>'
        );
      })
      .join('');
    return (
      '<div class="morbeez-portal__review-panel mt-4">' +
      '<h3 class="morbeez-portal__section-title">Rate your experience</h3>' +
      '<p class="text-sm text-[var(--color-muted)] mb-3">Share feedback on products from this delivered order.</p>' +
      cards +
      '</div>'
    );
  }

  function bindReviewForms(root, orderId, onSubmitted) {
    if (!root) return;
    root.querySelectorAll('[data-stars-for]').forEach(function (wrap) {
      var input = wrap.querySelector('.morbeez-portal__star-value');
      wrap.querySelectorAll('.morbeez-portal__star').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var val = Number(btn.getAttribute('data-star')) || 0;
          if (input) input.value = String(val);
          wrap.querySelectorAll('.morbeez-portal__star').forEach(function (star, idx) {
            star.classList.toggle('is-on', idx < val);
          });
        });
      });
    });
    root.querySelectorAll('[data-review-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var productKey = form.getAttribute('data-product-key');
        var starInput = form.querySelector('.morbeez-portal__star-value');
        var rating = Number(starInput && starInput.value) || 0;
        var errEl = form.querySelector('.morbeez-portal__review-error');
        var textEl = form.querySelector('.morbeez-portal__review-text');
        var submitBtn = form.querySelector('[type="submit"]');
        if (errEl) {
          errEl.textContent = '';
          errEl.classList.add('hidden');
        }
        if (rating < 1) {
          if (errEl) {
            errEl.textContent = 'Please select a star rating.';
            errEl.classList.remove('hidden');
          }
          return;
        }
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Saving…';
        }
        api('/api/v1/farmer/portal/orders/' + encodeURIComponent(orderId) + '/reviews', {
          method: 'POST',
          body: JSON.stringify({
            productKey: productKey,
            rating: rating,
            reviewText: textEl ? textEl.value : '',
          }),
        })
          .then(function () {
            if (typeof onSubmitted === 'function') onSubmitted();
          })
          .catch(function (err) {
            if (errEl) {
              errEl.textContent = err.message || 'Could not save review';
              errEl.classList.remove('hidden');
            }
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Submit review';
            }
          });
      });
    });
  }

  function closeTrackingModal() {
    var modal = $('portal-tracking-modal');
    if (modal) modal.remove();
    document.body.classList.remove('morbeez-portal--modal-open');
  }

  function showTrackingModal(orderId) {
    if (!orderId) return;
    closeTrackingModal();
    var overlay = document.createElement('div');
    overlay.id = 'portal-tracking-modal';
    overlay.className = 'morbeez-portal__modal-backdrop';
    overlay.innerHTML =
      '<div class="morbeez-portal__modal morbeez-portal__modal--tracking" role="dialog" aria-modal="true" aria-labelledby="portal-tracking-title">' +
      '<h2 id="portal-tracking-title" class="morbeez-portal__modal-title">Order tracking</h2>' +
      '<p class="morbeez-portal__modal-sub">Loading tracking details…</p>' +
      '<div class="morbeez-portal__tracking-loading">Please wait</div>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('morbeez-portal--modal-open');

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeTrackingModal();
    });

    api('/api/v1/farmer/portal/orders/' + encodeURIComponent(orderId) + '/tracking')
      .then(function (res) {
        var order = res.order || {};
        var tracking = res.tracking || {};
        var timeline = res.timeline || [];
        var lines = res.lineItems || order.lineItems || [];
        var canReview = !!res.canReview;
        var reviewLines = res.reviewLines || [];
        var reviewHtml = renderReviewSection(orderId, canReview, reviewLines);

        var timelineHtml =
          '<ol class="morbeez-portal__tracking-timeline">' +
          timeline
            .map(function (step) {
              var cls = step.done ? 'is-done' : step.pending ? 'is-pending' : '';
              return (
                '<li class="morbeez-portal__tracking-step ' +
                cls +
                '"><span class="morbeez-portal__tracking-dot"></span>' +
                '<div><strong>' +
                esc(step.label) +
                '</strong>' +
                (step.at ? '<div class="morbeez-portal__tracking-at">' + esc(step.at) + '</div>' : '') +
                '</div></li>'
              );
            })
            .join('') +
          '</ol>';

        var trackLink = tracking.trackingUrl
          ? '<a href="' +
            esc(tracking.trackingUrl) +
            '" target="_blank" rel="noopener" class="morbeez-btn-primary text-sm py-2 px-4 inline-flex mt-3">Track shipment ↗</a>'
          : '';

        var awbHtml = tracking.trackingAwb
          ? '<p><span class="morbeez-portal__tracking-label">AWB</span> <strong>' +
            esc(tracking.trackingAwb) +
            '</strong></p>'
          : '<p class="text-sm text-[var(--color-muted)]">AWB will appear once your order is shipped.</p>';

        var noteHtml = tracking.shiprocketNote
          ? '<p class="morbeez-portal__tracking-note">Courier note: ' + esc(tracking.shiprocketNote) + '</p>'
          : '';

        var itemsHtml = lines.length
          ? '<ul class="morbeez-portal__tracking-items">' +
            lines
              .map(function (li) {
                return (
                  '<li>' +
                  esc(li.title) +
                  ' <span class="text-[var(--color-muted)]">× ' +
                  esc(li.quantity || 1) +
                  '</span></li>'
                );
              })
              .join('') +
            '</ul>'
          : '';

        overlay.querySelector('.morbeez-portal__modal').innerHTML =
          '<button type="button" class="morbeez-portal__modal-close" id="portal-tracking-close" aria-label="Close">×</button>' +
          '<h2 id="portal-tracking-title" class="morbeez-portal__modal-title">' +
          esc(order.productTitle || order.orderNumber) +
          '</h2>' +
          '<p class="morbeez-portal__modal-sub">' +
          esc(order.orderNumber) +
          ' · ' +
          inr(order.amountInr) +
          ' · ' +
          esc(order.orderedOn) +
          '</p>' +
          '<div class="mt-3">' +
          badge(order.statusLabel, order.statusTone) +
          '</div>' +
          '<div class="morbeez-portal__tracking-meta">' +
          '<p><span class="morbeez-portal__tracking-label">Courier</span> <strong>' +
          esc(tracking.courier || '—') +
          '</strong></p>' +
          awbHtml +
          (tracking.expectedDelivery && tracking.expectedDelivery !== '—'
            ? '<p><span class="morbeez-portal__tracking-label">Expected delivery</span> <strong>' +
              esc(tracking.expectedDelivery) +
              '</strong></p>'
            : '') +
          (tracking.deliveryAddress
            ? '<p><span class="morbeez-portal__tracking-label">Deliver to</span> ' +
              esc(tracking.deliveryAddress) +
              '</p>'
            : '') +
          (tracking.paymentLabel
            ? '<p><span class="morbeez-portal__tracking-label">Payment</span> ' +
              esc(tracking.paymentLabel) +
              (tracking.paymentSubtext ? ' · ' + esc(tracking.paymentSubtext) : '') +
              '</p>'
            : '') +
          noteHtml +
          trackLink +
          '</div>' +
          reviewHtml +
          '<h3 class="morbeez-portal__section-title mt-4">Tracking timeline</h3>' +
          timelineHtml +
          (itemsHtml ? '<h3 class="morbeez-portal__section-title mt-4">Items</h3>' + itemsHtml : '') +
          '<div class="morbeez-portal__modal-actions mt-4">' +
          '<button type="button" class="morbeez-btn-secondary text-sm py-2 px-4" id="portal-tracking-dismiss">Close</button>' +
          '</div>';

        $('portal-tracking-close').addEventListener('click', closeTrackingModal);
        $('portal-tracking-dismiss').addEventListener('click', closeTrackingModal);
        bindReviewForms(overlay.querySelector('.morbeez-portal__modal'), orderId, function () {
          showTrackingModal(orderId);
        });
      })
      .catch(function (err) {
        overlay.querySelector('.morbeez-portal__modal').innerHTML =
          '<button type="button" class="morbeez-portal__modal-close" id="portal-tracking-close" aria-label="Close">×</button>' +
          '<h2 class="morbeez-portal__modal-title">Order tracking</h2>' +
          '<p class="morbeez-portal__form-error">' +
          esc(err.message || 'Could not load tracking') +
          '</p>' +
          '<div class="morbeez-portal__modal-actions mt-4">' +
          '<button type="button" class="morbeez-btn-secondary text-sm py-2 px-4" id="portal-tracking-dismiss">Close</button>' +
          '</div>';
        $('portal-tracking-close').addEventListener('click', closeTrackingModal);
        $('portal-tracking-dismiss').addEventListener('click', closeTrackingModal);
      });
  }

  function bindOrderTrackingClicks(root) {
    if (!root) return;
    root.querySelectorAll('[data-order-track]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-reorder], a, button')) return;
        showTrackingModal(el.getAttribute('data-order-track'));
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (e.target.closest('[data-reorder], a, button')) return;
          showTrackingModal(el.getAttribute('data-order-track'));
        }
      });
    });
  }

  function bindUpload() {
    var zone = $('portal-upload-zone');
    var input = $('portal-file-input');
    var status = $('portal-upload-status');
    if (!zone || !input) return;

    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      if (file.size > 8 * 1024 * 1024) {
        showError('Image must be under 8MB');
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var photoType = 'field';
        var checked = document.querySelector('input[name="photo-type"]:checked');
        if (checked) photoType = checked.value;
        if (status) {
          status.textContent = 'Uploading…';
          status.classList.remove('hidden');
        }
        api('/api/v1/farmer/portal/field-photos', {
          method: 'POST',
          body: JSON.stringify({
            photoType: photoType,
            imageData: reader.result,
            mimeType: file.type,
          }),
        })
          .then(function (res) {
            if (status) {
              status.textContent = res.message || 'Uploaded!';
              status.classList.remove('hidden');
            }
          })
          .catch(function (e) {
            showError(e.message);
          });
      };
      reader.readAsDataURL(file);
    }

    zone.addEventListener('click', function () {
      input.click();
    });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) handleFile(input.files[0]);
    });
    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('is-dragover');
    });
    zone.addEventListener('dragleave', function () {
      zone.classList.remove('is-dragover');
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('is-dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
  }

  function renderOrders() {
    var orders = (state.orders && state.orders.orders) || [];
    if (!orders.length) {
      $('panel-orders').innerHTML =
        '<div class="morbeez-portal__empty"><p>No orders yet.</p><a href="' +
        esc(cfg.shopUrl) +
        '" class="morbeez-btn-primary mt-4 inline-flex">Shop now</a></div>';
      return;
    }
    $('panel-orders').innerHTML =
      '<h1 class="morbeez-portal__greeting text-2xl mb-4">My orders</h1>' +
      '<div class="morbeez-portal__stack">' +
      orders
        .map(function (o) {
          var track =
            o.trackingUrl && o.trackingAwb
              ? '<a href="' +
                esc(o.trackingUrl) +
                '" target="_blank" rel="noopener" class="text-sm font-semibold text-[var(--color-primary)] mt-2 inline-block">Track ' +
                esc(o.trackingAwb) +
                '</a>'
              : '';
          return (
            '<div class="morbeez-portal__card morbeez-portal__order-card morbeez-portal__order-row--clickable" data-order-track="' +
            esc(o.id) +
            '" role="button" tabindex="0" aria-label="View tracking for ' +
            esc(o.orderNumber) +
            '">' +
            '<div class="morbeez-portal__order-row">' +
            (o.productImageUrl
              ? '<img class="morbeez-portal__order-img" src="' + esc(o.productImageUrl) + '" alt="" />'
              : '<div class="morbeez-portal__order-img"></div>') +
            '<div class="flex-1">' +
            '<p class="font-bold">' +
            esc(o.productTitle) +
            '</p>' +
            '<p class="mt-1">' +
            badge(o.statusLabel, o.statusTone) +
            ' <span class="text-sm text-[var(--color-muted)]">' +
            inr(o.amountInr) +
            '</span></p>' +
            '<p class="text-xs text-[var(--color-muted)] mt-1">' +
            esc(o.orderNumber) +
            ' · Qty ' +
            esc(o.quantity) +
            '</p>' +
            '<p class="text-xs text-[var(--color-muted)]">' +
            esc(o.orderedOn) +
            (o.deliveredOn && o.deliveredOn !== '—' ? ' · Delivered ' + esc(o.deliveredOn) : '') +
            '</p>' +
            '<p class="text-xs text-[var(--color-primary)] font-semibold mt-2">Tap for tracking' +
            (o.status === 'delivered' ? ' &amp; review' : '') +
            ' →</p>' +
            track +
            '<div class="flex flex-wrap gap-2 mt-3">' +
            '<button type="button" class="morbeez-btn-secondary text-sm py-2 px-3" data-reorder="' +
            esc(o.productTitle) +
            '">Reorder</button>' +
            '<a href="' +
            waUrl('Invoice request for order ' + o.orderNumber) +
            '" target="_blank" rel="noopener" class="morbeez-btn-ghost text-sm py-2 px-3">Get invoice</a>' +
            '</div></div></div></div>'
          );
        })
        .join('') +
      '</div>';
    document.querySelectorAll('#panel-orders [data-reorder]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        window.location.href = (cfg.searchUrl || '/search') + '?q=' + encodeURIComponent(btn.getAttribute('data-reorder') || '');
      });
    });
    bindOrderTrackingClicks($('panel-orders'));
  }

  function renderAdvisory() {
    var a = state.advisory;
    if (!a) return;
    var crop = a.crop;
    var recs = a.recommendations || [];
    var schedule = a.schedule || [];

    $('panel-advisory').innerHTML =
      '<h1 class="morbeez-portal__greeting text-2xl mb-2">Crop advisory</h1>' +
      (crop
        ? '<p class="morbeez-portal__sub mb-4">' +
          esc(crop.name) +
          (crop.fieldSize ? ' · ' + esc(crop.fieldSize) : '') +
          ' · ' +
          esc(crop.stage) +
          (crop.daysAfterPlanting != null ? ' · Day ' + esc(crop.daysAfterPlanting) : '') +
          '</p>'
        : '') +
      (schedule.length
        ? '<div class="morbeez-portal__card mb-4"><h2 class="morbeez-portal__section-title">Upcoming schedule</h2><ul class="morbeez-portal__list">' +
          schedule
            .map(function (s) {
              return '<li><strong>' + esc(s.dueLabel) + '</strong> — ' + esc(s.notes || s.type) + '</li>';
            })
            .join('') +
          '</ul></div>'
        : '') +
      (recs.length
        ? recs
            .map(function (r) {
              var bl =
                r.bullets && r.bullets.length
                  ? '<ul class="morbeez-portal__list">' +
                    r.bullets.map(function (b) {
                      return '<li>' + esc(b) + '</li>';
                    }).join('') +
                    '</ul>'
                  : '';
              return (
                '<div class="morbeez-portal__card">' +
                '<p class="text-xs text-[var(--color-muted)]">' +
                esc(r.dateLabel) +
                (r.dayLabel ? ' · ' + esc(r.dayLabel) : '') +
                '</p>' +
                '<h3 class="font-bold mt-1">' +
                esc(r.title) +
                '</h3>' +
                '<p class="text-sm text-[var(--color-muted)]">' +
                esc(r.cropName) +
                (r.blockName ? ' · ' + esc(r.blockName) : '') +
                '</p>' +
                bl +
                (r.applicationMethod
                  ? '<p class="text-sm mt-2"><strong>How:</strong> ' + esc(r.applicationMethod) + '</p>'
                  : '') +
                '</div>'
              );
            })
            .join('')
        : '<div class="morbeez-portal__empty"><p>No advisory yet.</p><a href="' +
          esc(cfg.cropDoctorUrl) +
          '" class="morbeez-btn-primary mt-3 inline-flex">Ask crop doctor</a> or chat on WhatsApp.</div>') +
      '<a href="' +
      waUrl('I need crop advisory for my field') +
      '" target="_blank" rel="noopener" class="morbeez-btn-whatsapp w-full mt-4 justify-center">Ask agronomist on WhatsApp</a>';
  }

  function renderReports() {
    var reports = (state.reports && state.reports.reports) || [];
    if (!reports.length) {
      $('panel-reports').innerHTML =
        '<div class="morbeez-portal__empty"><p>No soil reports yet.</p><p class="mt-2 text-sm">Share your lab report on WhatsApp and we\'ll add it here.</p><a href="' +
        waUrl('I want to share my soil test report') +
        '" class="morbeez-btn-whatsapp mt-4 inline-flex">Send on WhatsApp</a></div>';
      return;
    }
    $('panel-reports').innerHTML =
      '<h1 class="morbeez-portal__greeting text-2xl mb-4">Soil reports</h1>' +
      '<div class="morbeez-portal__stack">' +
      reports
        .map(function (r) {
          var pdf = r.pdfUrl
            ? '<a href="' + esc(r.pdfUrl) + '" target="_blank" rel="noopener" class="morbeez-btn-primary text-sm py-2 px-4 mt-3 inline-flex">Download PDF</a>'
            : '<span class="text-xs text-[var(--color-muted)] mt-2 block">PDF processing — contact support if needed</span>';
          return (
            '<div class="morbeez-portal__card">' +
            '<div class="flex justify-between items-start gap-2">' +
            '<div><p class="font-bold">' +
            esc(r.blockName) +
            '</p><p class="text-xs text-[var(--color-muted)]">' +
            esc(r.dateLabel) +
            '</p></div>' +
            badge(r.healthLabel, r.health) +
            '</div>' +
            (r.highlights.length
              ? '<p class="text-sm mt-2">' + r.highlights.map(esc).join(' · ') + '</p>'
              : '') +
            pdf +
            '</div>'
          );
        })
        .join('') +
      '</div>';
  }

  function renderSupport() {
    var roi = state.roi;
    var summary = roi && roi.summary ? roi.summary : {};
    var entries = (roi && roi.recentEntries) || [];
    var notifs = (state.summary && state.summary.notifications) || [];

    $('panel-support').innerHTML =
      '<h1 class="morbeez-portal__greeting text-2xl mb-4">Support &amp; ROI</h1>' +

      (notifs.length
        ? '<div class="morbeez-portal__card mb-4"><h2 class="morbeez-portal__section-title">Notifications</h2><ul class="morbeez-portal__list">' +
          notifs
            .map(function (n) {
              return '<li>' + esc(n.message) + ' <span class="text-[var(--color-muted)]">(' + esc(n.atLabel) + ')</span></li>';
            })
            .join('') +
          '</ul></div>'
        : '') +

      '<div class="morbeez-portal__card mb-4">' +
      '<h2 class="morbeez-portal__section-title">ROI tracker</h2>' +
      '<div class="morbeez-portal__glance-row">' +
      '<div class="morbeez-portal__glance"><div class="morbeez-portal__glance-value text-base">' +
      inr(summary.inputCostInr) +
      '</div><div class="morbeez-portal__glance-label">Input cost</div></div>' +
      '<div class="morbeez-portal__glance"><div class="morbeez-portal__glance-value text-base">' +
      inr(summary.estimatedYieldIncomeInr) +
      '</div><div class="morbeez-portal__glance-label">Est. income</div></div>' +
      '<div class="morbeez-portal__glance"><div class="morbeez-portal__glance-value text-base">' +
      inr(summary.estimatedProfitInr) +
      '</div><div class="morbeez-portal__glance-label">Est. profit</div></div>' +
      '</div>' +
      '<p class="text-xs text-[var(--color-muted)] mt-2">' +
      esc(summary.marketNote || '') +
      '</p>' +
      (entries.length
        ? '<ul class="morbeez-portal__list mt-3">' +
          entries
            .map(function (e) {
              return (
                '<li>' +
                esc(e.dateLabel) +
                ' · ' +
                esc(e.category) +
                ' · ' +
                inr(e.amountInr) +
                (e.note ? ' — ' + esc(e.note) : '') +
                '</li>'
              );
            })
            .join('') +
          '</ul>'
        : '') +
      '</div>' +

      '<div class="morbeez-portal__stack">' +
      '<a href="' +
      waUrl() +
      '" target="_blank" rel="noopener" class="morbeez-btn-whatsapp w-full justify-center text-base py-4">WhatsApp support</a>' +
      '<a href="tel:' +
      String(cfg.whatsappPhone || '').replace(/\D/g, '') +
      '" class="morbeez-btn-secondary w-full justify-center text-base py-4">Call agronomist</a>' +
      '<a href="' +
      waUrl('I would like to request a field visit') +
      '" target="_blank" rel="noopener" class="morbeez-btn-primary w-full justify-center text-base py-4">Request field visit</a>' +
      '</div>';
  }

  function loadSummary() {
    return api('/api/v1/farmer/portal/summary').then(function (data) {
      state.summary = data;
      renderHome();
      if (state.tab === 'support') renderSupport();
    });
  }

  function loadOrders() {
    return api('/api/v1/farmer/portal/orders').then(function (data) {
      state.orders = data;
      renderOrders();
    });
  }

  function loadAdvisory() {
    return api('/api/v1/farmer/portal/advisory').then(function (data) {
      state.advisory = data;
      renderAdvisory();
    });
  }

  function loadReports() {
    return api('/api/v1/farmer/portal/soil-reports').then(function (data) {
      state.reports = data;
      renderReports();
    });
  }

  function loadRoi() {
    return api('/api/v1/farmer/portal/roi').then(function (data) {
      state.roi = data;
      renderSupport();
    });
  }

  function showGate() {
    document.documentElement.classList.remove('morbeez-portal-authed');
    var gate = $('portal-gate');
    if (gate) {
      gate.hidden = false;
      gate.classList.remove('hidden');
    }
    var app = $('portal-app');
    if (app) app.classList.add('hidden');
    var nav = $('portal-bottom-nav');
    if (nav) nav.classList.add('hidden');
  }

  function showApp() {
    document.documentElement.classList.add('morbeez-portal-authed');
    var gate = $('portal-gate');
    if (gate) {
      gate.hidden = true;
      gate.classList.add('hidden');
    }
    var app = $('portal-app');
    if (app) app.classList.remove('hidden');
    var nav = $('portal-bottom-nav');
    if (nav) nav.classList.remove('hidden');
  }

  function init() {
    var token = getToken();
    if (!token) {
      showGate();
      return;
    }

    showApp();

    document.querySelectorAll('[data-portal-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTab(btn.getAttribute('data-portal-tab'));
      });
    });

    loadSummary()
      .then(function () {
        $('portal-loading').classList.add('hidden');
        $('portal-content').classList.remove('hidden');
      })
      .catch(function (e) {
        $('portal-loading').classList.add('hidden');
        if (e.message && /sign in|session|unauthorized/i.test(e.message)) {
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch (err) {}
          showGate();
        } else {
          showError(e.message || 'Could not load dashboard');
        }
      });

    document.addEventListener('morbeez:auth-changed', function () {
      if (!getToken()) window.location.reload();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

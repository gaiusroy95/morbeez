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
        '<div class="morbeez-portal__order-row">' +
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
      '<a href="' +
      waUrl('Please help me update my delivery address') +
      '" target="_blank" rel="noopener" class="morbeez-btn-primary text-sm py-2 px-4">Request update</a>' +
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

  function bindHomeEvents() {
    document.querySelectorAll('[data-go-tab]').forEach(function (el) {
      el.addEventListener('click', function () {
        setTab(el.getAttribute('data-go-tab'));
      });
    });
    document.querySelectorAll('[data-reorder]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var q = encodeURIComponent(btn.getAttribute('data-reorder') || '');
        window.location.href = (cfg.searchUrl || '/search') + '?q=' + q;
      });
    });
    var editBtn = $('portal-edit-address');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        var a1 = prompt('Street address');
        if (a1 == null) return;
        var city = prompt('City / district') || '';
        var state = prompt('State') || '';
        var pin = prompt('PIN code') || '';
        api('/api/v1/farmer/portal/address', {
          method: 'PATCH',
          body: JSON.stringify({ address1: a1, city: city, state: state, pincode: pin }),
        })
          .then(function () {
            return loadSummary();
          })
          .catch(function (e) {
            showError(e.message);
          });
      });
    }
    bindUpload();
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
            '<div class="morbeez-portal__card">' +
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
      btn.addEventListener('click', function () {
        window.location.href = (cfg.searchUrl || '/search') + '?q=' + encodeURIComponent(btn.getAttribute('data-reorder') || '');
      });
    });
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

  function init() {
    var token = getToken();
    if (!token) {
      $('portal-gate').classList.remove('hidden');
      return;
    }

    $('portal-gate').classList.add('hidden');
    $('portal-app').classList.remove('hidden');
    $('portal-bottom-nav').classList.remove('hidden');

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
          $('portal-app').classList.add('hidden');
          $('portal-bottom-nav').classList.add('hidden');
          $('portal-gate').classList.remove('hidden');
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

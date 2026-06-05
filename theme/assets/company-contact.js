/**
 * Load company profile from Morbeez API for footer, contact blocks, and legal lines.
 * Storefront: GET /apps/morbeez/company
 */
(function () {
  var root = document.querySelector('[data-morbeez-company]');
  if (!root) return;

  fetch('/apps/morbeez/company')
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      var c = data && data.company;
      if (!c) return;

      var addrEl = root.querySelector('[data-company-address]');
      if (addrEl && c.formattedAddress) {
        addrEl.textContent = c.formattedAddress;
        addrEl.hidden = false;
      }

      var phoneEl = root.querySelector('[data-company-phone]');
      if (phoneEl && c.customerCareNumber) {
        var phone = String(c.customerCareNumber).replace(/\s/g, '');
        phoneEl.innerHTML =
          '<a href="tel:' +
          phone +
          '" class="hover:text-[var(--color-accent)]">' +
          c.customerCareNumber +
          '</a>';
        phoneEl.hidden = false;
      }

      var waEl = root.querySelector('[data-company-whatsapp]');
      if (waEl && c.whatsappNumber) {
        var wa = String(c.whatsappNumber).replace(/\D/g, '');
        waEl.innerHTML =
          '<a href="https://wa.me/' +
          wa +
          '" class="hover:text-[var(--color-accent)]" target="_blank" rel="noopener noreferrer">WhatsApp: ' +
          c.whatsappNumber +
          '</a>';
        waEl.hidden = false;
      }

      var legalEl = root.querySelector('[data-company-legal]');
      if (legalEl) {
        var parts = [];
        if (c.cin) parts.push('CIN: ' + c.cin);
        if (c.gstin) parts.push('GSTIN: ' + c.gstin);
        if (c.licenceNumber) parts.push('Licence: ' + c.licenceNumber);
        if (parts.length) {
          legalEl.textContent = parts.join(' · ');
          legalEl.hidden = false;
        }
      }

      var nameEl = root.querySelector('[data-company-name]');
      if (nameEl && c.companyName) {
        nameEl.textContent = c.companyName;
        nameEl.hidden = false;
      }

      var waCta = document.querySelector('[data-morbeez-whatsapp-cta]');
      if (waCta && c.whatsappNumber) {
        waCta.setAttribute('data-wa-phone', c.whatsappNumber);
      }
    })
    .catch(function () {
      /* theme section fallbacks remain */
    });
})();

/**
 * Morbeez agronomy SEO pages — related products + guides hub via app proxy.
 */
(function () {
  const PROXY = '/apps/morbeez';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function productCard(p) {
    const img = p.imageUrl
      ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.title)}" class="h-40 w-full object-cover" loading="lazy" width="400" height="400">`
      : '<div class="flex h-40 items-center justify-center bg-[var(--color-surface)] text-3xl">🌱</div>';
    const price =
      p.price != null && p.price !== ''
        ? `<p class="mt-2 text-sm font-semibold text-[var(--color-primary)]">₹${Number(p.price).toLocaleString('en-IN')}</p>`
        : '';
    return `
      <a href="${escapeHtml(p.url)}" class="morbeez-card block overflow-hidden transition hover:border-[var(--color-primary)]">
        ${img}
        <div class="p-4">
          <h3 class="text-sm font-semibold text-[var(--color-trust)] line-clamp-2">${escapeHtml(p.title)}</h3>
          ${price}
        </div>
      </a>`;
  }

  function guideCard(page) {
    const tags = [page.crop, page.problem].filter(Boolean).join(' · ');
    return `
      <a href="/pages/${escapeHtml(page.slug)}" class="morbeez-card flex flex-col gap-2 p-5 transition hover:border-[var(--color-primary)]">
        ${tags ? `<p class="morbeez-eyebrow">${escapeHtml(tags)}</p>` : ''}
        <h3 class="font-semibold text-[var(--color-trust)]">${escapeHtml(page.title)}</h3>
        ${page.meta_description ? `<p class="text-sm text-[var(--color-muted)] line-clamp-3">${escapeHtml(page.meta_description)}</p>` : ''}
        <span class="mt-auto text-sm font-semibold text-[var(--color-primary)]">Read guide →</span>
      </a>`;
  }

  async function fetchJson(path) {
    const res = await fetch(`${PROXY}${path}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function initAgronomyPage(root) {
    const handle = root.dataset.pageHandle;
    if (!handle) return;
    try {
      const data = await fetchJson(`/seo/pages/${encodeURIComponent(handle)}`);
      const products = data.page?.relatedProducts ?? [];
      if (!products.length) return;
      const section = document.getElementById('agronomy-related-products');
      const grid = root.querySelector('[data-related-products-grid]');
      if (!section || !grid) return;
      grid.innerHTML = products.map(productCard).join('');
      section.hidden = false;
    } catch (e) {
      console.warn('[Morbeez] agronomy related products', e);
    }
  }

  async function initHub(root) {
    const grid = root.querySelector('[data-seo-hub-grid]');
    const loading = root.querySelector('[data-seo-hub-loading]');
    if (!grid) return;
    const pageType = root.dataset.pageType || '';
    const params = new URLSearchParams();
    if (pageType) params.set('pageType', pageType);
    params.set('limit', '24');
    try {
      const data = await fetchJson(`/seo/pages?${params}`);
      const pages = data.pages ?? [];
      if (loading) loading.remove();
      if (!pages.length) {
        grid.innerHTML = '<p class="col-span-full text-sm text-[var(--color-muted)]">No guides published yet.</p>';
        return;
      }
      grid.innerHTML = pages.map(guideCard).join('');
    } catch (e) {
      if (loading) loading.textContent = 'Could not load guides. Try again later.';
      console.warn('[Morbeez] SEO hub', e);
    }
  }

  function boot() {
    document.querySelectorAll('[data-agronomy-page]').forEach((el) => void initAgronomyPage(el));
    document.querySelectorAll('[data-seo-agronomy-hub]').forEach((el) => void initHub(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

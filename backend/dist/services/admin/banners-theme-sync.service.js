import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { supabase } from '../../lib/supabase.js';
import { shopifyAdmin } from '../shopify/shopify.client.js';
function storefrontUrl(path) {
    const base = (env.SHOPIFY_STOREFRONT_URL ?? `https://${env.SHOPIFY_STORE_DOMAIN}`).replace(/\/$/, '');
    if (path.startsWith('http://') || path.startsWith('https://'))
        return path;
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
function defaultSchedule() {
    return {
        startsAt: new Date(Date.now() - 86_400_000).toISOString(),
        endsAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
    };
}
function slideTitle(settings) {
    const parts = [settings.heading_line_1, settings.heading_highlight, settings.heading_line_2]
        .filter(Boolean)
        .map(String);
    if (parts.length)
        return parts.join(' ').trim();
    return String(settings.eyebrow ?? 'Homepage hero');
}
async function getMainThemeId() {
    const res = await shopifyAdmin('/themes.json');
    const main = res.themes.find((t) => t.role === 'main') ?? res.themes[0];
    if (!main)
        throw new AppError('No Shopify theme found', 404, 'THEME_NOT_FOUND');
    return main.id;
}
async function fetchIndexTemplate(themeId) {
    const res = await shopifyAdmin(`/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent('templates/index.json')}`);
    return JSON.parse(res.asset.value);
}
function collectImports(template) {
    const sections = template.sections ?? {};
    const rows = [];
    for (const [sectionId, section] of Object.entries(sections)) {
        if (section.type === 'hero-carousel' && section.blocks) {
            const order = section.block_order ?? Object.keys(section.blocks);
            let sortOrder = 0;
            for (const blockId of order) {
                const block = section.blocks[blockId];
                if (!block || block.type !== 'slide')
                    continue;
                const settings = block.settings ?? {};
                const schedule = defaultSchedule();
                rows.push({
                    sourceRef: `theme:hero:${blockId}`,
                    title: slideTitle(settings),
                    badge: settings.eyebrow ? String(settings.eyebrow) : undefined,
                    description: settings.subheading ? String(settings.subheading) : undefined,
                    ctaLabel: String(settings.button_label ?? 'Shop now'),
                    ctaUrl: settings.button_url ? storefrontUrl(String(settings.button_url)) : undefined,
                    placement: 'home_hero',
                    ...schedule,
                    sortOrder: sortOrder++,
                });
            }
        }
        if (section.type === 'seasonal-campaign') {
            const settings = section.settings ?? {};
            const schedule = defaultSchedule();
            rows.push({
                sourceRef: `theme:seasonal:${sectionId}`,
                title: String(settings.heading ?? 'Seasonal campaign'),
                badge: settings.badge ? String(settings.badge) : undefined,
                description: settings.text ? String(settings.text) : undefined,
                ctaLabel: String(settings.cta_label ?? 'Shop now'),
                ctaUrl: settings.cta_url ? storefrontUrl(String(settings.cta_url)) : undefined,
                placement: 'promo_strip',
                ...schedule,
                sortOrder: 0,
            });
        }
    }
    return rows;
}
async function upsertImport(row) {
    const { data: existing, error: findErr } = await supabase
        .from('commerce_banners')
        .select('id')
        .eq('source_ref', row.sourceRef)
        .maybeSingle();
    throwIfSupabaseError(findErr, 'Could not look up banner');
    const payload = {
        title: row.title.trim(),
        badge: row.badge?.trim() || null,
        description: row.description?.trim() || null,
        cta_label: row.ctaLabel.trim() || 'Shop now',
        cta_url: row.ctaUrl?.trim() || null,
        placement: row.placement,
        starts_at: row.startsAt,
        ends_at: row.endsAt,
        sort_order: row.sortOrder,
        active: true,
        source_ref: row.sourceRef,
        updated_at: new Date().toISOString(),
    };
    if (existing?.id) {
        const { error } = await supabase.from('commerce_banners').update(payload).eq('id', existing.id);
        throwIfSupabaseError(error, 'Could not update banner');
        return 'updated';
    }
    const { error } = await supabase.from('commerce_banners').insert(payload);
    throwIfSupabaseError(error, 'Could not create banner');
    return 'created';
}
export const bannersThemeSyncService = {
    async syncFromShopifyTheme() {
        const themeId = await getMainThemeId();
        const template = await fetchIndexTemplate(themeId);
        const imports = collectImports(template);
        if (!imports.length) {
            return { imported: 0, created: 0, updated: 0, themeId };
        }
        let created = 0;
        let updated = 0;
        for (const row of imports) {
            const result = await upsertImport(row);
            if (result === 'created')
                created += 1;
            else
                updated += 1;
        }
        return { imported: imports.length, created, updated, themeId };
    },
};
//# sourceMappingURL=banners-theme-sync.service.js.map
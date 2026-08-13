import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { supabase } from '../../lib/supabase.js';
import { parseHeroTitle, relativeStorefrontPath } from './banners-hero-title.util.js';
import { resolveBannerSize } from './banners-size.util.js';
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
function isActiveBanner(row) {
    if (!row.active)
        return false;
    const now = Date.now();
    return now >= new Date(row.starts_at).getTime() && now <= new Date(row.ends_at).getTime();
}
async function getTargetThemeId() {
    const configured = env.SHOPIFY_THEME_ID?.trim();
    if (configured) {
        const id = Number(configured);
        if (Number.isFinite(id) && id > 0)
            return id;
    }
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
async function saveIndexTemplate(themeId, template) {
    await shopifyAdmin(`/themes/${themeId}/assets.json`, {
        method: 'PUT',
        body: JSON.stringify({
            asset: {
                key: 'templates/index.json',
                value: JSON.stringify(template, null, 2),
            },
        }),
    });
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
async function listActiveBanners() {
    const { data, error } = await supabase
        .from('commerce_banners')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true })
        .order('starts_at', { ascending: false });
    throwIfSupabaseError(error, 'Could not load banners');
    return (data ?? []).filter((row) => isActiveBanner(row));
}
function buildHeroSlideSettings(banner) {
    const headings = parseHeroTitle(banner.title);
    const size = resolveBannerSize({
        sizeWidth: banner.size_width ?? undefined,
        sizeHeight: banner.size_height ?? undefined,
    });
    const settings = {
        eyebrow: banner.badge?.trim() || undefined,
        ...headings,
        highlight_color: '#34B35E',
        overlay: 45,
        button_label: banner.cta_label?.trim() || 'Shop now',
        button_url: relativeStorefrontPath(banner.cta_url),
        banner_width: size.width,
        banner_height: size.height,
    };
    const image = banner.image_url?.trim();
    if (image)
        settings.image_url = image;
    return settings;
}
function findHeroSectionId(template) {
    const sections = template.sections ?? {};
    for (const [sectionId, section] of Object.entries(sections)) {
        if (section.type === 'hero-carousel')
            return sectionId;
    }
    return null;
}
function findSeasonalSectionId(template) {
    const sections = template.sections ?? {};
    for (const [sectionId, section] of Object.entries(sections)) {
        if (section.type === 'seasonal-campaign')
            return sectionId;
    }
    return null;
}
export const bannersThemeSyncService = {
    async syncFromShopifyTheme() {
        const themeId = await getTargetThemeId();
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
    async syncToShopifyTheme() {
        const themeId = await getTargetThemeId();
        const template = await fetchIndexTemplate(themeId);
        const banners = await listActiveBanners();
        const heroBanners = banners.filter((b) => b.placement === 'home_hero');
        const promoBanner = banners.find((b) => b.placement === 'promo_strip');
        const heroSectionId = findHeroSectionId(template);
        if (heroSectionId && template.sections?.[heroSectionId]) {
            const blocks = {};
            const blockOrder = [];
            const sectionSize = resolveBannerSize({
                sizeWidth: heroBanners[0]?.size_width ?? undefined,
                sizeHeight: heroBanners[0]?.size_height ?? undefined,
            });
            for (let i = 0; i < heroBanners.length; i++) {
                const banner = heroBanners[i];
                const blockId = `staff_slide_${i + 1}`;
                blocks[blockId] = {
                    type: 'slide',
                    settings: buildHeroSlideSettings(banner),
                };
                blockOrder.push(blockId);
            }
            template.sections[heroSectionId] = {
                ...template.sections[heroSectionId],
                blocks,
                block_order: blockOrder,
                settings: {
                    ...(template.sections[heroSectionId].settings ?? {}),
                    banner_width: sectionSize.width,
                    banner_height: sectionSize.height,
                },
            };
        }
        const seasonalSectionId = findSeasonalSectionId(template);
        if (promoBanner && seasonalSectionId && template.sections?.[seasonalSectionId]) {
            const promoSize = resolveBannerSize({
                sizeWidth: promoBanner.size_width ?? undefined,
                sizeHeight: promoBanner.size_height ?? undefined,
            });
            const seasonalSettings = {
                ...(template.sections[seasonalSectionId].settings ?? {}),
                badge: promoBanner.badge?.trim() || undefined,
                heading: promoBanner.title.trim(),
                text: promoBanner.description?.trim() || undefined,
                cta_label: promoBanner.cta_label?.trim() || 'Shop now',
                cta_url: relativeStorefrontPath(promoBanner.cta_url),
                banner_width: promoSize.width,
                banner_height: promoSize.height,
            };
            const image = promoBanner.image_url?.trim();
            if (image)
                seasonalSettings.image_url = image;
            template.sections[seasonalSectionId] = {
                ...template.sections[seasonalSectionId],
                settings: seasonalSettings,
            };
        }
        await saveIndexTemplate(themeId, template);
        return {
            themeId,
            heroSlides: heroBanners.length,
            promoUpdated: Boolean(promoBanner && seasonalSectionId),
        };
    },
};
//# sourceMappingURL=banners-theme-sync.service.js.map
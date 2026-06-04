import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
function resolveStatus(startsAt, endsAt, active) {
    if (!active)
        return 'inactive';
    const now = Date.now();
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    if (now < start)
        return 'upcoming';
    if (now > end)
        return 'expired';
    return 'active';
}
function formatSchedule(startsAt, endsAt) {
    const fmt = (iso) => new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
    return `${fmt(startsAt)} – ${fmt(endsAt)}`;
}
function placementLabel(p) {
    const map = {
        home_hero: 'Homepage hero',
        collection_top: 'Collection top',
        promo_strip: 'Promo strip',
    };
    return map[p] ?? p;
}
function mapBanner(row) {
    const status = resolveStatus(row.starts_at, row.ends_at, row.active);
    return {
        id: row.id,
        title: row.title,
        badge: row.badge,
        description: row.description,
        imageUrl: row.image_url,
        ctaLabel: row.cta_label ?? 'Shop now',
        ctaUrl: row.cta_url,
        placement: row.placement,
        placementLabel: placementLabel(row.placement),
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        schedule: formatSchedule(row.starts_at, row.ends_at),
        sortOrder: row.sort_order,
        active: row.active,
        status,
    };
}
export const bannersAdminService = {
    async list(query) {
        const { data, error } = await supabase
            .from('commerce_banners')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('starts_at', { ascending: false });
        throwIfSupabaseError(error, 'Could not load banners');
        let all = (data ?? []).map((r) => mapBanner(r));
        const placement = query.placement;
        if (placement && placement !== 'all') {
            all = all.filter((b) => b.placement === placement);
        }
        const tabCounts = {
            all: all.length,
            active: all.filter((b) => b.status === 'active').length,
            upcoming: all.filter((b) => b.status === 'upcoming').length,
            expired: all.filter((b) => b.status === 'expired' || b.status === 'inactive').length,
        };
        const tab = query.tab ?? 'all';
        const banners = tab === 'all'
            ? all
            : tab === 'expired'
                ? all.filter((b) => b.status === 'expired' || b.status === 'inactive')
                : all.filter((b) => b.status === tab);
        return { banners, tabCounts };
    },
    async get(id) {
        const { data, error } = await supabase
            .from('commerce_banners')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        throwIfSupabaseError(error, 'Could not load banner');
        if (!data)
            throw new NotFoundError('Banner not found');
        return mapBanner(data);
    },
    async create(input) {
        if (new Date(input.endsAt) <= new Date(input.startsAt)) {
            throw new ValidationError('End date must be after start date');
        }
        const { data, error } = await supabase
            .from('commerce_banners')
            .insert({
            title: input.title.trim(),
            badge: input.badge?.trim() || null,
            description: input.description?.trim() || null,
            image_url: input.imageUrl?.trim() || null,
            cta_label: input.ctaLabel?.trim() || 'Shop now',
            cta_url: input.ctaUrl?.trim() || null,
            placement: input.placement ?? 'home_hero',
            starts_at: input.startsAt,
            ends_at: input.endsAt,
            sort_order: input.sortOrder ?? 0,
            active: input.active ?? true,
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not create banner');
        return mapBanner(data);
    },
    async update(id, input) {
        const existing = await this.get(id);
        const startsAt = input.startsAt ?? existing.startsAt;
        const endsAt = input.endsAt ?? existing.endsAt;
        if (new Date(endsAt) <= new Date(startsAt)) {
            throw new ValidationError('End date must be after start date');
        }
        const patch = { updated_at: new Date().toISOString() };
        if (input.title != null)
            patch.title = input.title.trim();
        if (input.badge != null)
            patch.badge = input.badge.trim() || null;
        if (input.description != null)
            patch.description = input.description.trim() || null;
        if (input.imageUrl != null)
            patch.image_url = input.imageUrl.trim() || null;
        if (input.ctaLabel != null)
            patch.cta_label = input.ctaLabel.trim() || 'Shop now';
        if (input.ctaUrl != null)
            patch.cta_url = input.ctaUrl.trim() || null;
        if (input.placement != null)
            patch.placement = input.placement;
        if (input.startsAt != null)
            patch.starts_at = input.startsAt;
        if (input.endsAt != null)
            patch.ends_at = input.endsAt;
        if (input.sortOrder != null)
            patch.sort_order = input.sortOrder;
        if (input.active != null)
            patch.active = input.active;
        const { data, error } = await supabase
            .from('commerce_banners')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not update banner');
        return mapBanner(data);
    },
};
//# sourceMappingURL=banners-admin.service.js.map
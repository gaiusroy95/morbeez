export type BannerTab = 'all' | 'active' | 'upcoming' | 'expired';
export type BannerPlacement = 'home_hero' | 'collection_top' | 'promo_strip';
export interface BannerListQuery {
    tab?: BannerTab;
    placement?: BannerPlacement | 'all';
}
export interface CreateBannerInput {
    title: string;
    badge?: string;
    description?: string;
    imageUrl?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    placement?: BannerPlacement;
    startsAt: string;
    endsAt: string;
    sortOrder?: number;
    active?: boolean;
}
export declare const bannersAdminService: {
    list(query: BannerListQuery): Promise<{
        banners: {
            id: string;
            title: string;
            badge: string | null;
            description: string | null;
            imageUrl: string | null;
            ctaLabel: string;
            ctaUrl: string | null;
            placement: BannerPlacement;
            placementLabel: string;
            startsAt: string;
            endsAt: string;
            schedule: string;
            sortOrder: number;
            active: boolean;
            status: "inactive" | BannerTab;
        }[];
        tabCounts: {
            all: number;
            active: number;
            upcoming: number;
            expired: number;
        };
    }>;
    get(id: string): Promise<{
        id: string;
        title: string;
        badge: string | null;
        description: string | null;
        imageUrl: string | null;
        ctaLabel: string;
        ctaUrl: string | null;
        placement: BannerPlacement;
        placementLabel: string;
        startsAt: string;
        endsAt: string;
        schedule: string;
        sortOrder: number;
        active: boolean;
        status: "inactive" | BannerTab;
    }>;
    create(input: CreateBannerInput): Promise<{
        id: string;
        title: string;
        badge: string | null;
        description: string | null;
        imageUrl: string | null;
        ctaLabel: string;
        ctaUrl: string | null;
        placement: BannerPlacement;
        placementLabel: string;
        startsAt: string;
        endsAt: string;
        schedule: string;
        sortOrder: number;
        active: boolean;
        status: "inactive" | BannerTab;
    }>;
    update(id: string, input: Partial<CreateBannerInput>): Promise<{
        id: string;
        title: string;
        badge: string | null;
        description: string | null;
        imageUrl: string | null;
        ctaLabel: string;
        ctaUrl: string | null;
        placement: BannerPlacement;
        placementLabel: string;
        startsAt: string;
        endsAt: string;
        schedule: string;
        sortOrder: number;
        active: boolean;
        status: "inactive" | BannerTab;
    }>;
};
//# sourceMappingURL=banners-admin.service.d.ts.map
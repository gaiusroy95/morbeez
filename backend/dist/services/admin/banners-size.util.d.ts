export declare const BANNER_SIZE_PRESETS: readonly [{
    readonly value: "1920x720";
    readonly width: 1920;
    readonly height: 720;
    readonly label: "1920 × 720 (Desktop hero)";
}, {
    readonly value: "1920x600";
    readonly width: 1920;
    readonly height: 600;
    readonly label: "1920 × 600 (Wide hero)";
}, {
    readonly value: "1600x600";
    readonly width: 1600;
    readonly height: 600;
    readonly label: "1600 × 600";
}, {
    readonly value: "1440x480";
    readonly width: 1440;
    readonly height: 480;
    readonly label: "1440 × 480";
}, {
    readonly value: "1200x400";
    readonly width: 1200;
    readonly height: 400;
    readonly label: "1200 × 400 (Promo strip)";
}, {
    readonly value: "1080x1080";
    readonly width: 1080;
    readonly height: 1080;
    readonly label: "1080 × 1080 (Square)";
}];
export type BannerSizePreset = (typeof BANNER_SIZE_PRESETS)[number]['value'];
export declare function formatBannerSize(width: number, height: number): string;
export declare function parseBannerSize(value: string | null | undefined): {
    width: number;
    height: number;
} | null;
export declare function resolveBannerSize(input?: {
    size?: string;
    sizeWidth?: number;
    sizeHeight?: number;
}): {
    width: number;
    height: number;
    size: string;
};
//# sourceMappingURL=banners-size.util.d.ts.map
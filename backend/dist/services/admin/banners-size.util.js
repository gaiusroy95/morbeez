export const BANNER_SIZE_PRESETS = [
    { value: '1920x720', width: 1920, height: 720, label: '1920 × 720 (Desktop hero)' },
    { value: '1920x600', width: 1920, height: 600, label: '1920 × 600 (Wide hero)' },
    { value: '1600x600', width: 1600, height: 600, label: '1600 × 600' },
    { value: '1440x480', width: 1440, height: 480, label: '1440 × 480' },
    { value: '1200x400', width: 1200, height: 400, label: '1200 × 400 (Promo strip)' },
    { value: '1080x1080', width: 1080, height: 1080, label: '1080 × 1080 (Square)' },
];
export function formatBannerSize(width, height) {
    return `${width}x${height}`;
}
export function parseBannerSize(value) {
    if (!value?.trim())
        return null;
    const match = value.trim().match(/^(\d{3,4})\s*[x×]\s*(\d{2,4})$/i);
    if (!match)
        return null;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height))
        return null;
    if (width < 320 || width > 3840 || height < 120 || height > 2160)
        return null;
    return { width, height };
}
export function resolveBannerSize(input) {
    if (input?.sizeWidth && input?.sizeHeight) {
        return {
            width: input.sizeWidth,
            height: input.sizeHeight,
            size: formatBannerSize(input.sizeWidth, input.sizeHeight),
        };
    }
    const parsed = parseBannerSize(input?.size);
    if (parsed) {
        return { ...parsed, size: formatBannerSize(parsed.width, parsed.height) };
    }
    return { width: 1920, height: 720, size: '1920x720' };
}
//# sourceMappingURL=banners-size.util.js.map
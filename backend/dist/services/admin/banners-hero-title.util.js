/** Map staff banner title into hero-carousel heading fields. */
export function parseHeroTitle(title) {
    const trimmed = title.trim();
    if (!trimmed)
        return {};
    const threePart = trimmed.match(/^(.*?)\s+([A-Z][A-Z0-9\s&·'\-]+)\s+(.+)$/);
    if (threePart) {
        return {
            heading_line_1: threePart[1].trim() || undefined,
            heading_highlight: threePart[2].trim(),
            heading_line_2: threePart[3].trim(),
        };
    }
    const twoPart = trimmed.match(/^([A-Z][A-Z0-9\s&·'\-]+)\s+(.+)$/);
    if (twoPart) {
        return {
            heading_highlight: twoPart[1].trim(),
            heading_line_2: twoPart[2].trim(),
        };
    }
    return { heading_line_2: trimmed };
}
export function relativeStorefrontPath(url) {
    if (!url?.trim())
        return '';
    const value = url.trim();
    if (value.startsWith('/'))
        return value;
    try {
        const parsed = new URL(value);
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    catch {
        return value.startsWith('/') ? value : `/${value}`;
    }
}
//# sourceMappingURL=banners-hero-title.util.js.map
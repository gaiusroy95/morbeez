/** Supabase may return a one-to-many embed as a single object when only one row exists. */
export function normalizeRelation(raw) {
    if (!raw)
        return [];
    if (Array.isArray(raw))
        return raw;
    return [raw];
}
export function normalizePickLists(raw) {
    return normalizeRelation(raw);
}
export function pickListLineCount(pickLists) {
    const lists = normalizePickLists(pickLists);
    const pick = lists[0];
    const lines = pick?.pick_list_lines;
    if (!Array.isArray(lines) || !lines.length)
        return 0;
    return lines.reduce((sum, l) => sum + Math.max(0, Number(l.qty_required) || 1), 0);
}
//# sourceMappingURL=fulfillment-queue.utils.js.map
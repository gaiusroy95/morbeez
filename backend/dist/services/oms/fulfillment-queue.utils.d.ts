/** Supabase may return a one-to-many embed as a single object when only one row exists. */
export declare function normalizeRelation<T>(raw: unknown): T[];
export declare function normalizePickLists<T extends {
    pick_list_lines?: unknown;
}>(raw: unknown): T[];
export declare function pickListLineCount(pickLists: Array<{
    pick_list_lines?: Array<{
        qty_required?: number;
    }>;
}>): number;
//# sourceMappingURL=fulfillment-queue.utils.d.ts.map
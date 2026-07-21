import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
function isMissingRelation(error) {
    if (!error)
        return false;
    const message = error.message ?? '';
    return error.code === '42P01'
        || error.code === 'PGRST205'
        || (/does not exist|Could not find the table/i.test(message));
}
/**
 * Loads optional farmer/product/unit terminology expansions for extraction prompts.
 * Soft-fails when the foundation migration has not been applied yet.
 */
export async function loadFarmActivityTerminologyExpansion(input) {
    const empty = {
        language: input.languageHint ?? 'en',
        farmerOverrides: [],
        productAliases: [],
        unitAliases: [],
    };
    try {
        const [overrides, products, units] = await Promise.all([
            supabase
                .from('farmer_terminology_overrides')
                .select('term, resolved_meaning, standard_term')
                .eq('farmer_id', input.farmerId)
                .eq('active', true)
                .limit(100),
            supabase
                .from('farm_activity_product_aliases')
                .select('alias, canonical_product_key')
                .eq('status', 'approved')
                .or(`farmer_id.eq.${input.farmerId},farmer_id.is.null`)
                .limit(100),
            supabase
                .from('farm_activity_unit_aliases')
                .select('alias, canonical_unit')
                .eq('status', 'approved')
                .or(`farmer_id.eq.${input.farmerId},farmer_id.is.null`)
                .limit(100),
        ]);
        if (isMissingRelation(overrides.error) || isMissingRelation(products.error) || isMissingRelation(units.error)) {
            return empty;
        }
        return {
            language: input.languageHint ?? 'en',
            farmerOverrides: (overrides.data ?? []).map((row) => ({
                term: String(row.term),
                resolvedMeaning: String(row.resolved_meaning),
                standardTerm: row.standard_term ? String(row.standard_term) : null,
            })),
            productAliases: (products.data ?? []).map((row) => ({
                alias: String(row.alias),
                canonicalProductKey: String(row.canonical_product_key),
            })),
            unitAliases: (units.data ?? []).map((row) => ({
                alias: String(row.alias),
                canonicalUnit: String(row.canonical_unit),
            })),
        };
    }
    catch (error) {
        logger.warn({ err: error, farmerId: input.farmerId }, 'Farm activity terminology expansion unavailable');
        return empty;
    }
}
//# sourceMappingURL=farm-activity-terminology.service.js.map
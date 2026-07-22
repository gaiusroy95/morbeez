import { compatibilityLookupService, } from '../whatsapp/pipeline/compatibility-lookup.service.js';
function uniqueMaterialNames(materials) {
    const seen = new Set();
    const names = [];
    for (const material of materials) {
        const name = material.technicalName.trim();
        if (!name)
            continue;
        const key = name.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        names.push(name);
    }
    return names;
}
export const recommendationCompatibilityService = {
    async checkPair(productA, productB) {
        return compatibilityLookupService.lookup(productA, productB);
    },
    async checkMaterials(materials) {
        const names = uniqueMaterialNames(materials);
        const pairs = [];
        for (let i = 0; i < names.length; i++) {
            for (let j = i + 1; j < names.length; j++) {
                const productA = names[i];
                const productB = names[j];
                const lookup = await compatibilityLookupService.lookup(productA, productB);
                pairs.push({
                    ...lookup,
                    productA: lookup.productA ?? productA,
                    productB: lookup.productB ?? productB,
                });
            }
        }
        return {
            pairs,
            hasIncompatiblePair: pairs.some((pair) => pair.found && pair.compatible === false),
            hasUnknownPair: pairs.some((pair) => !pair.found),
        };
    },
};
//# sourceMappingURL=recommendation-compatibility.service.js.map
import {
  compatibilityLookupService,
  type CompatibilityLookupResult,
} from '../whatsapp/pipeline/compatibility-lookup.service.js';

export type MaterialCompatibilityPair = CompatibilityLookupResult & {
  productA: string;
  productB: string;
};

export type MaterialCompatibilityReport = {
  pairs: MaterialCompatibilityPair[];
  hasIncompatiblePair: boolean;
  hasUnknownPair: boolean;
};

function uniqueMaterialNames(materials: Array<{ technicalName: string }>): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const material of materials) {
    const name = material.technicalName.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export const recommendationCompatibilityService = {
  async checkPair(productA: string, productB: string): Promise<CompatibilityLookupResult> {
    return compatibilityLookupService.lookup(productA, productB);
  },

  async checkMaterials(
    materials: Array<{ technicalName: string }>
  ): Promise<MaterialCompatibilityReport> {
    const names = uniqueMaterialNames(materials);
    const pairs: MaterialCompatibilityPair[] = [];

    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const productA = names[i]!;
        const productB = names[j]!;
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

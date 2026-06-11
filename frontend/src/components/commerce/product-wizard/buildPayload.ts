import { uniqueCropsFromMappings } from './cropMapping';
import type { WizardFormState } from './types';

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function buildTags(state: WizardFormState): string {
  const tags: string[] = [];
  if (state.basic.featured) tags.push('featured');
  if (state.basic.bestSeller) tags.push('best-seller');
  if (state.basic.trending) tags.push('trending');
  for (const c of uniqueCropsFromMappings(state.usage.cropMappings)) tags.push(c);
  return tags.join(', ');
}

export function buildWizardPayload(
  state: WizardFormState,
  status: 'active' | 'draft' | 'archived'
) {
  const title =
    state.basic.tradeName.trim() ||
    state.basic.technicalName.trim() ||
    'New product';

  const mappings = state.usage.cropMappings;
  const crops = uniqueCropsFromMappings(mappings);
  const primary = mappings[0];
  const pests = uniqueValues(mappings.map((m) => m.pest));
  const diseases = uniqueValues(mappings.map((m) => m.disease));
  const symptoms = uniqueValues(mappings.flatMap((m) => m.symptoms.split(',')));

  return {
    title,
    bodyHtml: state.basic.longDescription || '',
    vendor: state.basic.brandName || 'Morbeez',
    productType: state.basic.category || '',
    tags: buildTags(state),
    status,
    skuPrefix: state.basic.skuPrefix || '',
    variants: state.basic.variants.map((v) => ({
      packSize: String(v.packSize || '1'),
      unit: v.unit || 'ml',
      mrp: String(v.mrp || '0'),
      sellingPrice: String(v.sellingPrice || '0'),
      dealerPrice: String(v.dealerPrice || ''),
      stock: Number(v.stock) || 0,
      ...(v.id ? { id: v.id } : {}),
      ...(v.sku ? { sku: v.sku } : {}),
    })),
    intelligence: {
      basic: {
        ...state.basic,
        technicalContent: state.basic.technicalName.trim(),
        benefits: state.basic.benefits.filter((b) => b.trim()),
        variants: state.basic.variants,
      },
      agriculture: {
        brandName: state.basic.brandName,
        tradeName: state.basic.tradeName,
        technicalName: state.basic.technicalName,
        category: state.basic.category,
        subCategory: state.basic.subCategory,
        productType: state.basic.formulationType,
        technicalContent: state.basic.technicalName.trim(),
        modeOfAction: state.basic.modeOfAction,
        modeOfEntry: state.basic.modeOfEntry,
        recommendedCrops: crops.join(', '),
        dosePerAcre: primary?.dosageAcre ?? '',
        compatibility: primary?.compatibility ?? '',
      },
      aiMapping: {
        crops,
        cropMappings: mappings.map(({ id, ...rest }) => rest),
        crop: primary?.crop ?? '',
        pest: primary?.pest ?? '',
        disease: primary?.disease ?? '',
        pests,
        diseases,
        symptoms: symptoms.join(', '),
        dosage: primary?.dosageAcre ?? '',
        waterVolume: primary?.dosageWater ?? '',
        applicationStage: primary?.applicationStage ?? '',
        sprayInterval: primary?.sprayIntervalDays ?? '',
        compatibleProducts: primary?.compatibility ?? '',
        targetPests: pests.join(', '),
        targetDiseases: diseases.join(', '),
      },
      seo: {
        seoTitle: state.seo.seoTitle,
        seoDescription: state.seo.seoDescription,
        urlHandle: state.seo.urlSlug,
        videoUrl: state.media.videoUrl,
        youtubeLink: state.media.youtubeUrl,
        labelPdfUrl: state.media.labelUrl,
        technicalPdfUrl: state.media.sdsUrl,
        brochureUrl: state.media.brochureUrl,
        featuredProduct: state.seo.featuredProduct,
        bestSellerFlag: state.seo.bestSellerFlag,
      },
      crossSell: {},
    },
  };
}

import type { WizardFormState } from './types';

function buildTags(state: WizardFormState): string {
  const tags: string[] = [];
  if (state.basic.featured) tags.push('featured');
  if (state.basic.bestSeller) tags.push('best-seller');
  if (state.basic.trending) tags.push('trending');
  for (const c of state.usage.crops) tags.push(c);
  if (state.usage.crop && !state.usage.crops.includes(state.usage.crop)) {
    tags.push(state.usage.crop);
  }
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

  const crops = [...state.usage.crops];
  if (state.usage.crop && !crops.includes(state.usage.crop)) crops.push(state.usage.crop);

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
        technicalContent: state.basic.technicalContent,
        modeOfAction: state.basic.modeOfAction,
        modeOfEntry: state.basic.modeOfEntry,
        recommendedCrops: crops.join(', '),
        dosePerAcre: state.usage.dosageAcre,
        compatibility: state.usage.compatibility,
      },
      aiMapping: {
        crops,
        crop: state.usage.crop,
        pest: state.usage.pest,
        disease: state.usage.disease,
        symptoms: state.usage.symptoms,
        dosage: state.usage.dosageAcre,
        waterVolume: state.usage.dosageWater,
        applicationStage: state.usage.applicationStage,
        sprayInterval: state.usage.sprayIntervalDays,
        compatibleProducts: state.usage.compatibility,
        targetPests: state.usage.pest,
        targetDiseases: state.usage.disease,
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

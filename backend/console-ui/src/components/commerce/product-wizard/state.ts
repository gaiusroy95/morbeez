import type { ProductImage, WizardFormState, WizardVariant } from './types';

export function emptyVariant(): WizardVariant {
  return {
    packSize: '',
    unit: 'ml',
    mrp: '',
    sellingPrice: '',
    dealerPrice: '',
    stock: 0,
  };
}

export function defaultWizardState(): WizardFormState {
  return {
    productId: null,
    basic: {
      brandName: 'Katyayani',
      tradeName: '',
      technicalName: '',
      category: '',
      subCategory: '',
      formulationType: '',
      technicalContent: '',
      casNumber: '',
      hsnCode: '',
      productType: '',
      modeOfAction: '',
      modeOfEntry: '',
      countryOfOrigin: 'India',
      gstPercent: '18',
      shortDescription: '',
      longDescription: '',
      featured: false,
      bestSeller: true,
      trending: true,
      active: true,
      benefits: [''],
      shelfLife: '2 Years',
      storageConditions: 'Store in cool, dry place',
      packingType: 'Bottle',
      packMaterial: 'HDPE Bottle',
      safetyInstructions: '',
      skuPrefix: '',
      variants: [emptyVariant()],
      publishOn: '',
    },
    usage: {
      crop: '',
      pest: '',
      disease: '',
      symptoms: '',
      dosageAcre: '',
      dosageWater: '',
      applicationStage: '',
      sprayIntervalDays: '',
      compatibility: '',
      crops: [],
    },
    media: {
      videoUrl: '',
      youtubeUrl: '',
      brochureUrl: '',
      labelUrl: '',
      sdsUrl: '',
    },
    seo: {
      seoTitle: '',
      seoDescription: '',
      urlSlug: '',
      featuredProduct: false,
      bestSellerFlag: false,
    },
    images: [],
    pendingImages: [],
  };
}

export function mergeIntelligence(
  state: WizardFormState,
  intel: Record<string, unknown> | null | undefined
): WizardFormState {
  if (!intel) return state;
  const basic = (intel.basic ?? {}) as Record<string, unknown>;
  const ag = (intel.agriculture ?? {}) as Record<string, unknown>;
  const ai = (intel.aiMapping ?? intel.ai_mapping ?? {}) as Record<string, unknown>;
  const seo = (intel.seo ?? {}) as Record<string, unknown>;

  const cropsRaw = ai.crops;
  const crops = Array.isArray(cropsRaw)
    ? cropsRaw.map(String)
    : typeof cropsRaw === 'string'
      ? cropsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : typeof ag.recommendedCrops === 'string'
        ? ag.recommendedCrops.split(',').map((s) => s.trim()).filter(Boolean)
        : state.usage.crops;

  const benefitsRaw = basic.benefits;
  const benefits = Array.isArray(benefitsRaw)
    ? benefitsRaw.map(String).filter(Boolean)
    : state.basic.benefits;

  return {
    ...state,
    basic: {
      ...state.basic,
      brandName: String(basic.brandName ?? state.basic.brandName),
      tradeName: String(basic.tradeName ?? ag.tradeName ?? state.basic.tradeName),
      technicalName: String(basic.technicalName ?? ag.technicalName ?? state.basic.technicalName),
      category: String(basic.category ?? ag.category ?? state.basic.category),
      subCategory: String(basic.subCategory ?? ag.subCategory ?? state.basic.subCategory),
      formulationType: String(
        basic.formulationType ?? ag.productType ?? state.basic.formulationType
      ),
      technicalContent: String(basic.technicalContent ?? state.basic.technicalContent),
      casNumber: String(basic.casNumber ?? state.basic.casNumber),
      hsnCode: String(basic.hsnCode ?? state.basic.hsnCode),
      productType: String(basic.productType ?? state.basic.productType),
      modeOfAction: String(basic.modeOfAction ?? ag.modeOfAction ?? state.basic.modeOfAction),
      modeOfEntry: String(basic.modeOfEntry ?? ag.modeOfEntry ?? state.basic.modeOfEntry),
      gstPercent: String(basic.gstPercent ?? state.basic.gstPercent),
      shortDescription: String(basic.shortDescription ?? state.basic.shortDescription),
      longDescription: String(basic.longDescription ?? state.basic.longDescription),
      shelfLife: String(basic.shelfLife ?? state.basic.shelfLife),
      storageConditions: String(basic.storageConditions ?? state.basic.storageConditions),
      skuPrefix: String(basic.skuPrefix ?? state.basic.skuPrefix),
      safetyInstructions: String(basic.safetyInstructions ?? state.basic.safetyInstructions),
      featured: Boolean(basic.featured ?? state.basic.featured),
      bestSeller: Boolean(basic.bestSeller ?? state.basic.bestSeller),
      trending: Boolean(basic.trending ?? state.basic.trending),
      benefits: benefits.length ? benefits : state.basic.benefits,
    },
    usage: {
      ...state.usage,
      crop: String(state.usage.crop || crops[0] || ''),
      dosageAcre: String(ai.dosage ?? ag.dosePerAcre ?? state.usage.dosageAcre),
      dosageWater: String(ai.waterVolume ?? state.usage.dosageWater),
      applicationStage: String(ai.applicationStage ?? state.usage.applicationStage),
      sprayIntervalDays: String(ai.sprayInterval ?? state.usage.sprayIntervalDays),
      compatibility: String(ai.compatibleProducts ?? ag.compatibility ?? state.usage.compatibility),
      symptoms: String(ai.symptoms ?? state.usage.symptoms),
      pest: String(ai.pest ?? ai.targetPests ?? state.usage.pest),
      disease: String(ai.disease ?? ai.targetDiseases ?? state.usage.disease),
      crops,
    },
    seo: {
      ...state.seo,
      seoTitle: String(seo.seoTitle ?? state.seo.seoTitle),
      seoDescription: String(seo.seoDescription ?? state.seo.seoDescription),
      urlSlug: String(seo.urlHandle ?? seo.urlSlug ?? state.seo.urlSlug),
      featuredProduct: Boolean(seo.featuredProduct ?? state.seo.featuredProduct),
      bestSellerFlag: Boolean(seo.bestSellerFlag ?? state.seo.bestSellerFlag),
    },
    media: {
      ...state.media,
      videoUrl: String(seo.videoUrl ?? state.media.videoUrl),
      youtubeUrl: String(seo.youtubeLink ?? seo.youtubeUrl ?? state.media.youtubeUrl),
      labelUrl: String(seo.labelPdfUrl ?? state.media.labelUrl),
      sdsUrl: String(seo.technicalPdfUrl ?? state.media.sdsUrl),
      brochureUrl: String(seo.brochureUrl ?? state.media.brochureUrl),
    },
  };
}

export function loadFromProduct(
  state: WizardFormState,
  product: Record<string, unknown>
): WizardFormState {
  const variants = (product.variants as Array<Record<string, unknown>> | undefined)?.map((v) => ({
    id: String(v.id ?? ''),
    packSize: String(v.packSize ?? ''),
    unit: String(v.unit ?? 'ml'),
    mrp: String(v.mrp ?? v.price ?? ''),
    sellingPrice: String(v.price ?? ''),
    dealerPrice: String(v.dealerPrice ?? ''),
    stock: Number(v.inventory ?? 0),
    sku: String(v.sku ?? ''),
  }));

  return {
    ...state,
    productId: String(product.id ?? state.productId),
    basic: {
      ...state.basic,
      tradeName: state.basic.tradeName || String(product.title ?? ''),
      technicalName:
        state.basic.technicalName || String(product.title ?? ''),
      category:
        state.basic.category ||
        String(product.category ?? product.productType ?? ''),
      longDescription:
        state.basic.longDescription || String(product.bodyHtml ?? ''),
      brandName: state.basic.brandName || String(product.vendor ?? 'Morbeez'),
      active: product.status === 'active',
      variants: variants?.length ? variants : state.basic.variants,
    },
    images: (product.images as ProductImage[] | undefined) ?? state.images,
    seo: {
      ...state.seo,
      seoTitle: state.seo.seoTitle || String(product.title ?? ''),
      urlSlug: state.seo.urlSlug || String(product.handle ?? ''),
    },
  };
}

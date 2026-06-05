export type WizardVariant = {
  id?: string;
  packSize: string;
  unit: string;
  mrp: string;
  sellingPrice: string;
  dealerPrice: string;
  stock: number;
  sku?: string;
};

export type PendingImage = {
  id: string;
  previewUrl: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
  alt?: string;
  isPrimary?: boolean;
};

export type ProductImage = {
  id: string;
  src: string;
  alt?: string | null;
};

export type WizardFormState = {
  productId: string | null;
  basic: {
    brandName: string;
    tradeName: string;
    technicalName: string;
    category: string;
    subCategory: string;
    formulationType: string;
    technicalContent: string;
    casNumber: string;
    hsnCode: string;
    productType: string;
    modeOfAction: string;
    modeOfEntry: string;
    countryOfOrigin: string;
    gstPercent: string;
    shortDescription: string;
    longDescription: string;
    featured: boolean;
    bestSeller: boolean;
    trending: boolean;
    active: boolean;
    benefits: string[];
    shelfLife: string;
    storageConditions: string;
    packingType: string;
    packMaterial: string;
    safetyInstructions: string;
    skuPrefix: string;
    warehouseId: string;
    warehouseName: string;
    rackId: string;
    rackRow: string;
    locationId: string;
    variants: WizardVariant[];
    publishOn: string;
  };
  usage: {
    crop: string;
    pest: string;
    disease: string;
    symptoms: string;
    dosageAcre: string;
    dosageWater: string;
    applicationStage: string;
    sprayIntervalDays: string;
    compatibility: string;
    crops: string[];
  };
  media: {
    videoUrl: string;
    youtubeUrl: string;
    brochureUrl: string;
    labelUrl: string;
    sdsUrl: string;
  };
  seo: {
    seoTitle: string;
    seoDescription: string;
    urlSlug: string;
    featuredProduct: boolean;
    bestSellerFlag: boolean;
  };
  images: ProductImage[];
  pendingImages: PendingImage[];
};

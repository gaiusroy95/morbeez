export const WIZARD_STEPS = [
  { n: 1, title: 'Basic Information', sub: 'Product details' },
  { n: 2, title: 'Variants & Pricing', sub: 'Pack sizes & pricing' },
  { n: 3, title: 'Usage & Details', sub: 'Crop, pest & dosage' },
  { n: 4, title: 'Media & SEO', sub: 'Images, videos & SEO' },
  { n: 5, title: 'Review & Publish', sub: 'Final review' },
] as const;

export const CATEGORIES = [
  'Insecticide',
  'Fungicide',
  'Fertilizer',
  'PGR',
  'Micronutrient',
  'Bio Stimulant',
  'Herbicide',
  'Other',
] as const;

export const SUB_CATEGORIES = [
  'Diamide Insecticide',
  'Neonicotinoid',
  'Triazole Fungicide',
  'NPK Fertilizer',
  'Growth Regulator',
  'Other',
] as const;

export const FORMULATION_TYPES = [
  'SC (Suspension Concentrate)',
  'EC (Emulsifiable Concentrate)',
  'WP (Wettable Powder)',
  'WG (Water Dispersible Granule)',
  'SL (Soluble Liquid)',
  'Other',
] as const;

export const MODE_OF_ENTRY = [
  'Systemic & Contact',
  'Systemic',
  'Contact',
  'Other',
] as const;

export const PRODUCT_TYPES = [
  'Chemical Insecticide',
  'Chemical Fungicide',
  'Organic Input',
  'Bio Pesticide',
  'Other',
] as const;

export const BRANDS = ['Katyayani', 'Morbeez', 'UPL', 'Bayer', 'Syngenta', 'Other'] as const;

export const UNITS = ['ml', 'L', 'kg', 'g'] as const;

export const CROP_OPTIONS = [
  'Paddy',
  'Ginger',
  'Banana',
  'Chili',
  'Cotton',
  'Tomato',
  'Maize',
  'Sugarcane',
  'Cardamom',
  'Pepper',
] as const;

export const PEST_OPTIONS = [
  'Stem borer',
  'Leaf folder',
  'Thrips',
  'Aphids',
  'Whitefly',
  'Fruit borer',
] as const;

export const DISEASE_OPTIONS = [
  'Leaf spot',
  'Blight',
  'Powdery mildew',
  'Root rot',
  'Anthracnose',
] as const;

export const APPLICATION_STAGES = [
  'Vegetative',
  'Flowering',
  'Fruit development',
  'Pre-harvest',
  'Post-harvest',
] as const;

export const SHELF_LIFE_OPTIONS = ['1 Year', '2 Years', '3 Years', '5 Years'] as const;

export const STORAGE_OPTIONS = [
  'Store in cool, dry place',
  'Store below 25°C',
  'Avoid direct sunlight',
  'Refrigerate after opening',
] as const;

export const PACKING_TYPES = ['Bottle', 'Pouch', 'Jar', 'Can', 'Bag'] as const;

export const PACK_MATERIALS = ['HDPE Bottle', 'PET Bottle', 'Laminated pouch', 'Tin'] as const;

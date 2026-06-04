export type MasterPickerItem = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
};

export function marketKeyFromItem(item: Pick<MasterPickerItem, 'name' | 'category'>): string {
  const district = item.category?.trim();
  const marketName = item.name.trim();
  return district ? `${marketName}|${district}` : marketName;
}

export function labelFromMasterItem(item: Pick<MasterPickerItem, 'name' | 'category'>): string {
  const district = item.category?.trim();
  return district ? `${item.name} (${district})` : item.name;
}

export function cropSlugFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

export function itemMatchesCropSlug(item: Pick<MasterPickerItem, 'name'>, slug: string): boolean {
  if (!slug) return false;
  return cropSlugFromName(item.name) === slug.trim().toLowerCase();
}

export function parseMarketKey(key: string): { marketName: string; district: string } {
  const [marketName, district = ''] = key.split('|');
  return { marketName: marketName.trim(), district: district.trim() };
}

export function itemMatchesMarketKey(item: MasterPickerItem, key: string): boolean {
  return marketKeyFromItem(item) === key;
}

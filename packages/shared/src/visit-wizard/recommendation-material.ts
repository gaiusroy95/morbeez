export type DoseBasis = 'per_200_ltr_water' | 'per_acre';
export type DoseUnit = 'KG' | 'LTR' | 'ML';
export type MaterialApplicationMode = 'foliar' | 'soil_application' | 'drenching';

export type RecommendationGroupMaterialDraft = {
  localId: string;
  issueLocalId: string;
  category: string;
  /** Product / material name */
  technicalName: string;
  /** Numeric dose amount (e.g. 2, 500) */
  doseQuantity?: string;
  doseUnit?: DoseUnit;
  doseBasis?: DoseBasis;
  applicationMode?: MaterialApplicationMode;
  /** Composed dose string — set on submit or when loading legacy drafts */
  dose?: string;
  /** Composed application mode label — set on submit or when loading legacy drafts */
  method?: string;
  relatedIssueLocalId?: string;
};

export type RecommendationGroupDraft = {
  localId: string;
  applicationType: string;
  applicationDay: number;
  sortOrder: number;
  materials: RecommendationGroupMaterialDraft[];
};

export const DOSE_BASIS_OPTIONS: Array<{ value: DoseBasis; label: string }> = [
  { value: 'per_200_ltr_water', label: 'Per 200 ltr water' },
  { value: 'per_acre', label: 'Per acre' },
];

export const DOSE_UNIT_OPTIONS: DoseUnit[] = ['KG', 'LTR', 'ML'];

export const MATERIAL_APPLICATION_MODE_OPTIONS: Array<{ value: MaterialApplicationMode; label: string }> = [
  { value: 'foliar', label: 'Foliar' },
  { value: 'soil_application', label: 'Soil application' },
  { value: 'drenching', label: 'Drenching' },
];

export function defaultRecommendationMaterial(
  issueLocalId: string,
  localId: string
): RecommendationGroupMaterialDraft {
  return {
    localId,
    issueLocalId,
    category: 'fungicide',
    technicalName: '',
    doseQuantity: '',
    doseUnit: 'ML',
    doseBasis: 'per_200_ltr_water',
    applicationMode: 'foliar',
  };
}

export function formatMaterialDose(
  material: Pick<RecommendationGroupMaterialDraft, 'doseQuantity' | 'doseUnit' | 'doseBasis' | 'dose'>
): string {
  const qty = material.doseQuantity?.trim();
  if (qty && material.doseUnit && material.doseBasis) {
    const basis =
      DOSE_BASIS_OPTIONS.find((o) => o.value === material.doseBasis)?.label ?? material.doseBasis;
    return `${qty} ${material.doseUnit} ${basis}`;
  }
  return material.dose?.trim() ?? '';
}

export function formatMaterialApplicationMode(mode?: MaterialApplicationMode | string): string {
  if (!mode) return '';
  const found = MATERIAL_APPLICATION_MODE_OPTIONS.find((o) => o.value === mode);
  return found?.label ?? String(mode);
}

export function mapRecommendationGroupsForSubmit(
  groups: RecommendationGroupDraft[],
  issueLocalIdToIndex: (localId: string) => number
) {
  return groups.map((g) => ({
    applicationType: g.applicationType,
    applicationDay: g.applicationDay,
    sortOrder: g.sortOrder,
    materials: g.materials.map((m) => ({
      issueIndex: issueLocalIdToIndex(m.issueLocalId),
      category: m.category,
      technicalName: m.technicalName.trim(),
      dose: formatMaterialDose(m),
      method: formatMaterialApplicationMode(m.applicationMode),
      relatedIssueIndex: m.relatedIssueLocalId
        ? issueLocalIdToIndex(m.relatedIssueLocalId)
        : undefined,
    })),
  }));
}

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

/** Per-issue recommendation line captured on Validation (step 6); combined into groups on step 7. */
export type IssueRecommendationLine = {
  localId: string;
  applicationType: string;
  applicationDay: number;
  technicalName: string;
  doseQuantity?: string;
  doseUnit?: DoseUnit;
  doseBasis?: DoseBasis;
  applicationMode?: MaterialApplicationMode;
};

export const APPLICATION_TYPE_OPTIONS = [
  'foliar_spray',
  'soil_drench',
  'granular',
  'seed_treatment',
  'other',
] as const;

export const APPLICATION_DAY_OPTIONS = [0, 7, 14, 21] as const;

export const DOSE_BASIS_OPTIONS: Array<{ value: DoseBasis; label: string }> = [
  { value: 'per_200_ltr_water', label: 'Per 200 ltr water' },
  { value: 'per_acre', label: 'Per acre' },
];

export const DOSE_UNIT_OPTIONS: DoseUnit[] = ['KG', 'LTR', 'ML'];

export const MATERIAL_APPLICATION_MODE_OPTIONS: Array<{
  value: MaterialApplicationMode;
  label: string;
}> = [
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

export function defaultIssueRecommendationLine(localId: string): IssueRecommendationLine {
  return {
    localId,
    applicationType: 'foliar_spray',
    applicationDay: 0,
    technicalName: '',
    doseQuantity: '',
    doseUnit: 'ML',
    doseBasis: 'per_200_ltr_water',
    applicationMode: 'foliar',
  };
}

export function formatMaterialDose(
  material: Pick<
    RecommendationGroupMaterialDraft | IssueRecommendationLine,
    'doseQuantity' | 'doseUnit' | 'doseBasis'
  > & { dose?: string }
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

/** Combine per-issue recommendation lines into tank-mix groups keyed by application type + day. */
export function composeRecommendationGroupsFromIssues(
  issues: Array<{ localId: string; recommendationLines?: IssueRecommendationLine[] | null }>
): RecommendationGroupDraft[] {
  const map = new Map<string, RecommendationGroupDraft>();

  for (const issue of issues) {
    for (const line of issue.recommendationLines ?? []) {
      const key = `${line.applicationType}|${line.applicationDay}`;
      let group = map.get(key);
      if (!group) {
        group = {
          localId: `grp-${line.applicationType}-d${line.applicationDay}-${map.size}`,
          applicationType: line.applicationType,
          applicationDay: line.applicationDay,
          sortOrder: map.size,
          materials: [],
        };
        map.set(key, group);
      }
      group.materials.push({
        localId: line.localId,
        issueLocalId: issue.localId,
        category: 'other',
        technicalName: line.technicalName ?? '',
        doseQuantity: line.doseQuantity,
        doseUnit: line.doseUnit,
        doseBasis: line.doseBasis,
        applicationMode: line.applicationMode,
      });
    }
  }

  return [...map.values()].sort(
    (a, b) => a.applicationDay - b.applicationDay || a.sortOrder - b.sortOrder
  );
}

export function issueRecommendationLinesToLegacyRecommendations(
  lines: IssueRecommendationLine[] | null | undefined
): Array<{
  recommendationType: 'other';
  priority: 'normal';
  status: 'open';
  text: string;
  activeIngredient?: string;
  dose?: string;
  method?: string;
}> {
  return (lines ?? [])
    .filter((l) => l.technicalName.trim())
    .map((l) => {
      const dose = formatMaterialDose(l);
      const method = formatMaterialApplicationMode(l.applicationMode);
      const day = `Day ${l.applicationDay}`;
      const appType = l.applicationType.replace(/_/g, ' ');
      return {
        recommendationType: 'other' as const,
        priority: 'normal' as const,
        status: 'open' as const,
        activeIngredient: l.technicalName.trim(),
        dose,
        method,
        text: [l.technicalName.trim(), dose, method, appType, day].filter(Boolean).join(' — '),
      };
    });
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

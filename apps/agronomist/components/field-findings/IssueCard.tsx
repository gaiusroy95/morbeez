import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ISSUE_STATUSES,
  RECORD_SEVERITIES,
  APPLICATION_DAY_OPTIONS,
  APPLICATION_TYPE_OPTIONS,
  DOSE_BASIS_OPTIONS,
  DOSE_UNIT_OPTIONS,
  MATERIAL_APPLICATION_MODE_OPTIONS,
  buildFarmerExperienceSections,
  defaultIssueRecommendationLine,
  formatActiveIngredientLine,
  formatMaterialApplicationMode,
  formatMaterialDose,
  issueRecommendationLinesToLegacyRecommendations,
  tokens,
  type IssueCategory,
  type IssueMasterRow,
  type IssueRecommendationLine,
  type IssueStatus,
  type RecordSeverity,
  type VisitPhotoInput,
  type VisitIssueDraft,
  type RecommendationPriority,
} from '@morbeez/shared';
import { Btn, DynamicSelect, Panel, MULTILINE_MIN_HEIGHT } from '@morbeez/ui-native';
import { SegmentedChips } from './SegmentedChips';
import {
  getFallbackIssueTypes,
  getIssueCategoryLabel,
  ISSUE_CATEGORY_OPTIONS,
  issueCategoryHint,
} from './wizard/visitIssueTypes';
import { type FarmerVisitFeedback } from './wizard/farmerVisitFeedback';

function slugLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^\w]/g, '');
}

const SEVERITY_LABELS: Record<RecordSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const STATUS_LABELS: Record<IssueStatus, string> = {
  open: 'Open',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

type PhotoPreview = { uri: string; filename: string; mimeType: string; dataBase64: string };

export type IssueDraft = Omit<VisitIssueDraft, 'photos'> & {
  categoryLabel?: string;
  photosPreview?: PhotoPreview[];
  photos?: (VisitPhotoInput & { uri?: string })[];
  aiDosage?: string;
  aiPriority?: RecommendationPriority;
};

type Props = {
  issue: IssueDraft;
  issueMaster: IssueMasterRow[];
  cropType: string;
  farmerFeedback?: FarmerVisitFeedback | null;
  onChange: (next: IssueDraft) => void;
  onRemove?: () => void;
  onCreateIssueType?: (input: {
    category: IssueCategory;
    issueName: string;
    cropType: string;
  }) => Promise<IssueMasterRow | null>;
};

export function IssueCard({
  issue,
  issueMaster,
  cropType,
  farmerFeedback,
  onChange,
  onRemove,
  onCreateIssueType,
}: Props) {
  const [farmerExpOpen, setFarmerExpOpen] = useState(false);
  const [extraCategories, setExtraCategories] = useState<Array<{ value: IssueCategory; label: string }>>([]);
  const [extraTypes, setExtraTypes] = useState<Array<{ key: string; value: string; label: string }>>([]);

  const categoryOptions = useMemo(() => {
    const base = ISSUE_CATEGORY_OPTIONS.map((o) => ({
      key: o.value,
      value: o.value,
      label: o.label,
    }));
    const extras = extraCategories.map((o) => ({
      key: `custom-cat:${o.label}`,
      value: `other:${o.label}`,
      label: o.label,
    }));
    return [...base, ...extras];
  }, [extraCategories]);

  const categoryValue = issue.categoryLabel ? `other:${issue.categoryLabel}` : issue.category;

  function applyCategoryValue(value: string) {
    if (value.startsWith('other:')) {
      const label = value.slice(6);
      onChange({ ...issue, category: 'other', categoryLabel: label, issueName: '', issueMasterId: undefined });
      return;
    }
    onChange({
      ...issue,
      category: value as IssueCategory,
      categoryLabel: undefined,
      issueName: '',
      issueMasterId: undefined,
    });
  }

  async function addCategory(name: string) {
    const label = name.trim();
    if (!label) return;
    setExtraCategories((prev) => (prev.some((c) => c.label === label) ? prev : [...prev, { value: 'other', label }]));
    onChange({ ...issue, category: 'other', categoryLabel: label, issueName: '', issueMasterId: undefined });
  }

  const nameOptions = useMemo(() => {
    const cropKey = cropType.trim().toLowerCase().replace(/[\s-]+/g, '_');
    const filtered = issueMaster.filter((m) => {
      if (m.category !== issue.category) return false;
      if (!m.cropType) return true;
      const masterCrop = m.cropType.trim().toLowerCase().replace(/[\s-]+/g, '_');
      return masterCrop === cropKey || masterCrop === cropType.trim().toLowerCase();
    });

    const seen = new Set<string>();
    const options: Array<{ key: string; value: string; label: string }> = [];

    for (const m of filtered) {
      const label = m.issueName.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      options.push({ key: m.id, value: m.issueName, label: m.issueName });
    }

    // Always merge crop fallbacks so the picker is never empty when master API returns no rows.
    for (const [index, name] of getFallbackIssueTypes(cropType, issue.category).entries()) {
      const key = name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      options.push({
        key: `fallback-${issue.category}-${index}`,
        value: name,
        label: name,
      });
    }

    return [...options, ...extraTypes];
  }, [issueMaster, issue.category, cropType, extraTypes]);

  async function addIssueType(name: string) {
    const issueName = name.trim();
    if (!issueName) return;
    if (onCreateIssueType) {
      const row = await onCreateIssueType({ category: issue.category, issueName, cropType });
      if (row) {
        onChange({ ...issue, issueName: row.issueName, issueMasterId: row.id });
        return;
      }
    }
    const key = `local-type:${slugLabel(issueName)}`;
    setExtraTypes((prev) =>
      prev.some((t) => t.value === issueName) ? prev : [...prev, { key, value: issueName, label: issueName }]
    );
    onChange({ ...issue, issueName, issueMasterId: undefined });
  }

  const farmerSections = buildFarmerExperienceSections(farmerFeedback ?? undefined);
  const hasFarmerExperience =
    farmerSections.observations.length > 0 ||
    farmerSections.activeIngredients.length > 0 ||
    farmerSections.symptomsReported ||
    farmerSections.responseAfterApplication;

  return (
    <Panel title="Issue details">
      <Text style={styles.hint}>{issueCategoryHint(cropType)}</Text>

      <DynamicSelect
        label="Issue category"
        placeholder="Select category"
        value={categoryValue}
        options={categoryOptions}
        allowAdd
        addPlaceholder="New category label"
        addButtonLabel="Add"
        onChange={(value) => applyCategoryValue(value)}
        onAdd={addCategory}
      />

      <DynamicSelect
        label="Issue type"
        placeholder={`Select ${getIssueCategoryLabel(issue.category).toLowerCase()} type`}
        value={issue.issueName}
        options={nameOptions}
        allowAdd
        addPlaceholder="New issue type"
        addButtonLabel="Add"
        onChange={(name, option) =>
          onChange({
            ...issue,
            issueName: name,
            issueMasterId: option && !option.key.startsWith('fallback-') && !option.key.startsWith('local-type:') ? option.key : undefined,
          })
        }
        onAdd={addIssueType}
      />
      <Text style={styles.label}>Severity</Text>
      <SegmentedChips
        options={RECORD_SEVERITIES.map((v) => ({ value: v, label: SEVERITY_LABELS[v] }))}
        value={issue.severity}
        onChange={(severity) => onChange({ ...issue, severity })}
      />
      <Text style={styles.label}>Status</Text>
      <SegmentedChips
        options={ISSUE_STATUSES.map((v) => ({ value: v, label: STATUS_LABELS[v] }))}
        value={issue.status ?? 'open'}
        onChange={(status) => onChange({ ...issue, status })}
      />
      <Text style={styles.label}>Agronomist notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={issue.observation ?? ''}
        onChangeText={(observation) => onChange({ ...issue, observation })}
        multiline
        placeholder="Your field observations and validation notes…"
        placeholderTextColor={tokens.textMuted}
      />
      {hasFarmerExperience ? (
        <View style={styles.farmerExpSection}>
          <Pressable style={styles.farmerExpHeader} onPress={() => setFarmerExpOpen((v) => !v)}>
            <Text style={styles.farmerExpTitle}>
              {farmerExpOpen ? '▼' : '▶'} Farmer experience
            </Text>
          </Pressable>
          {farmerExpOpen ? (
            <View style={styles.farmerExpBody}>
              {farmerSections.observations.length ? (
                <>
                  <Text style={styles.farmerExpLabel}>Symptoms reported</Text>
                  {farmerSections.observations.map((o) => (
                    <Text key={o} style={styles.farmerExpLine}>
                      • {o}
                    </Text>
                  ))}
                </>
              ) : null}
              {farmerSections.activeIngredients.length ? (
                <>
                  <Text style={styles.farmerExpLabel}>Active ingredients applied</Text>
                  {farmerSections.activeIngredients.map((item) => (
                    <Text key={item.label} style={styles.farmerExpLine}>
                      • {formatActiveIngredientLine(item)}
                    </Text>
                  ))}
                </>
              ) : null}
              {farmerSections.symptomsReported ? (
                <>
                  <Text style={styles.farmerExpLabel}>Field notes</Text>
                  <Text style={styles.farmerExpLine}>{farmerSections.symptomsReported}</Text>
                </>
              ) : null}
              {farmerSections.responseAfterApplication ? (
                <>
                  <Text style={styles.farmerExpLabel}>Response after application</Text>
                  <Text style={styles.farmerExpLine}>{farmerSections.responseAfterApplication}</Text>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {onRemove ? <Btn label="Remove issue" variant="secondary" onPress={onRemove} /> : null}
      <InlineRecommendations issue={issue} onChange={onChange} />
    </Panel>
  );
}

function newRecLocalId() {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function applyRecommendationLines(
  issue: IssueDraft,
  lines: IssueRecommendationLine[]
): IssueDraft {
  const legacy = issueRecommendationLinesToLegacyRecommendations(lines);
  return {
    ...issue,
    recommendationLines: lines,
    recommendations: legacy,
    finalRecommendation: legacy.map((r) => r.text).join('\n') || issue.finalRecommendation,
  };
}

function InlineRecommendations({ issue, onChange }: { issue: IssueDraft; onChange: (next: IssueDraft) => void }) {
  const lines = issue.recommendationLines ?? [];

  const doseBasisOptions = DOSE_BASIS_OPTIONS.map((o) => ({
    key: o.value,
    value: o.value,
    label: o.label,
  }));
  const doseUnitOptions = DOSE_UNIT_OPTIONS.map((unit) => ({
    key: unit,
    value: unit,
    label: unit,
  }));
  const applicationModeOptions = MATERIAL_APPLICATION_MODE_OPTIONS.map((o) => ({
    key: o.value,
    value: o.value,
    label: o.label,
  }));

  function updateLine(index: number, patch: Partial<IssueRecommendationLine>) {
    const next = lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
    onChange(applyRecommendationLines(issue, next));
  }

  function addRec() {
    onChange(
      applyRecommendationLines(issue, [...lines, defaultIssueRecommendationLine(newRecLocalId())])
    );
  }

  function removeRec(index: number) {
    onChange(applyRecommendationLines(issue, lines.filter((_, i) => i !== index)));
  }

  return (
    <View style={styles.recSection}>
      <Text style={styles.label}>Recommendations for this issue</Text>
      <Text style={styles.recHint}>
        Add materials for this issue. Step 7 (Recommendations) combines them into groups by day and application type.
      </Text>
      {lines.map((line, index) => (
        <View key={line.localId} style={styles.materialBox}>
          <Text style={styles.materialTitle}>Material {index + 1}</Text>
          <Text style={styles.fieldLabel}>Linked issue</Text>
          <View style={styles.chips}>
            <View style={[styles.chip, styles.chipActive]}>
              <Text style={[styles.chipText, styles.chipTextActive]}>
                {issue.issueName || issue.finalDiagnosis || 'This issue'}
              </Text>
            </View>
          </View>
          <Text style={styles.fieldLabel}>Application type</Text>
          <View style={styles.chips}>
            {APPLICATION_TYPE_OPTIONS.map((t) => {
              const active = line.applicationType === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.chip, active ? styles.chipActive : null]}
                  onPress={() => updateLine(index, { applicationType: t })}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                    {t.replace(/_/g, ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldLabel}>Application day</Text>
          <View style={styles.chips}>
            {APPLICATION_DAY_OPTIONS.map((d) => {
              const active = line.applicationDay === d;
              return (
                <Pressable
                  key={d}
                  style={[styles.chip, active ? styles.chipActive : null]}
                  onPress={() => updateLine(index, { applicationDay: d })}
                >
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>Day {d}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Product / material name"
            value={line.technicalName}
            onChangeText={(technicalName) => updateLine(index, { technicalName })}
          />
          <Text style={styles.fieldLabel}>Dose</Text>
          <TextInput
            style={styles.input}
            placeholder="Quantity (e.g. 2, 500)"
            value={line.doseQuantity ?? ''}
            onChangeText={(doseQuantity) => updateLine(index, { doseQuantity })}
            keyboardType="decimal-pad"
          />
          <DynamicSelect
            label="Dose per"
            placeholder="Select basis"
            value={line.doseBasis ?? ''}
            options={doseBasisOptions}
            onChange={(value) => updateLine(index, { doseBasis: value as IssueRecommendationLine['doseBasis'] })}
          />
          <DynamicSelect
            label="Qty unit"
            placeholder="Select unit"
            value={line.doseUnit ?? ''}
            options={doseUnitOptions}
            onChange={(value) => updateLine(index, { doseUnit: value as IssueRecommendationLine['doseUnit'] })}
          />
          <DynamicSelect
            label="Application mode"
            placeholder="Select mode"
            value={line.applicationMode ?? ''}
            options={applicationModeOptions}
            onChange={(value) =>
              updateLine(index, { applicationMode: value as IssueRecommendationLine['applicationMode'] })
            }
          />
          {(line.technicalName.trim() || line.doseQuantity?.trim()) ? (
            <Text style={styles.composePreview}>
              {[
                line.technicalName.trim(),
                formatMaterialDose(line),
                formatMaterialApplicationMode(line.applicationMode),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          <Btn label="Remove material" variant="secondary" onPress={() => removeRec(index)} />
        </View>
      ))}
      <Btn label="Add recommendation" variant="secondary" onPress={addRec} />
    </View>
  );
}

export function IssueCategoryPicker({
  selected,
  onToggle,
}: {
  selected: IssueCategory[];
  onToggle: (category: IssueCategory) => void;
}) {
  return (
    <Panel title="Issues present">
      <Text style={styles.hint}>Select categories to add issue cards.</Text>
      <View style={styles.row}>
        {ISSUE_CATEGORY_OPTIONS.map((option) => {
          const active = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => onToggle(option.value)}
              style={[styles.catChip, active && styles.catChipActive]}
            >
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 6, marginTop: 8 },
  hint: { fontSize: 13, color: tokens.textMuted, marginBottom: 10 },
  input: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: tokens.text,
  },
  textArea: { minHeight: MULTILINE_MIN_HEIGHT, textAlignVertical: 'top' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  },
  catChipActive: { backgroundColor: tokens.green100, borderColor: tokens.green500 },
  catChipText: { fontSize: 13, color: tokens.textMuted },
  catChipTextActive: { color: tokens.green800, fontWeight: '600' },
  recSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: tokens.border },
  recHint: { fontSize: 12, color: tokens.textMuted, lineHeight: 16, marginBottom: 8 },
  materialBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bg,
    gap: 4,
  },
  materialTitle: { fontSize: 14, fontWeight: '700', color: tokens.text, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: tokens.card,
  },
  chipActive: { borderColor: tokens.green700, backgroundColor: tokens.green100 },
  chipText: { fontSize: 12, color: tokens.text },
  chipTextActive: { color: tokens.green800, fontWeight: '700' },
  composePreview: { fontSize: 12, color: tokens.textMuted, marginTop: 6, marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: tokens.textMuted, marginTop: 8, marginBottom: 4 },
  farmerExpSection: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    overflow: 'hidden',
    marginTop: 4,
  },
  farmerExpHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: tokens.bg,
  },
  farmerExpTitle: { fontSize: 13, fontWeight: '700', color: tokens.text },
  farmerExpBody: {
    padding: 12,
    gap: 6,
    backgroundColor: tokens.card,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
  },
  farmerExpLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.textMuted,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  farmerExpLine: { fontSize: 13, color: tokens.textSecondary, lineHeight: 18 },
});

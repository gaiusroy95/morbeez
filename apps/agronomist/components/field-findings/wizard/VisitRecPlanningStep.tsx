import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  defaultRecommendationMaterial,
  DOSE_BASIS_OPTIONS,
  DOSE_UNIT_OPTIONS,
  MATERIAL_APPLICATION_MODE_OPTIONS,
  tokens,
  type RecommendationGroupDraft,
} from '@morbeez/shared';
import { Btn, DynamicSelect, Panel } from '@morbeez/ui-native';
import type { IssueDraft } from '../IssueCard';

const APPLICATION_DAYS = [0, 7, 14, 21] as const;
const APPLICATION_TYPES = ['foliar_spray', 'soil_drench', 'granular', 'seed_treatment', 'other'] as const;

type Props = {
  issues: IssueDraft[];
  groups: RecommendationGroupDraft[];
  onChange: (groups: RecommendationGroupDraft[]) => void;
};

function newLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toSelectOptions<T extends string>(items: Array<{ value: T; label: string }>) {
  return items.map((item) => ({ key: item.value, value: item.value, label: item.label }));
}

export function VisitRecPlanningStep({ issues, groups, onChange }: Props) {
  const issueOptions = useMemo(
    () => issues.map((i) => ({ id: i.localId, label: i.issueName })),
    [issues]
  );

  const doseBasisOptions = useMemo(() => toSelectOptions(DOSE_BASIS_OPTIONS), []);
  const doseUnitOptions = useMemo(
    () => DOSE_UNIT_OPTIONS.map((unit) => ({ key: unit, value: unit, label: unit })),
    []
  );
  const applicationModeOptions = useMemo(() => toSelectOptions(MATERIAL_APPLICATION_MODE_OPTIONS), []);

  function addGroup() {
    const issueLocalId = issues[0]?.localId ?? '';
    onChange([
      ...groups,
      {
        localId: newLocalId('grp'),
        applicationType: 'foliar_spray',
        applicationDay: 0,
        sortOrder: groups.length,
        materials: issueLocalId ? [defaultRecommendationMaterial(issueLocalId, newLocalId('mat'))] : [],
      },
    ]);
  }

  function updateGroup(index: number, patch: Partial<RecommendationGroupDraft>) {
    onChange(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function addMaterial(groupIndex: number) {
    const g = groups[groupIndex];
    if (!g) return;
    const issueLocalId = issues[0]?.localId ?? '';
    updateGroup(groupIndex, {
      materials: [...g.materials, defaultRecommendationMaterial(issueLocalId, newLocalId('mat'))],
    });
  }

  function updateMaterial(
    groupIndex: number,
    matIndex: number,
    patch: Partial<RecommendationGroupDraft['materials'][number]>
  ) {
    const g = groups[groupIndex];
    if (!g) return;
    updateGroup(groupIndex, {
      materials: g.materials.map((m, i) => (i === matIndex ? { ...m, ...patch } : m)),
    });
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Plan recommendation groups with application day and materials (name, dose, qty unit, application mode).
      </Text>
      {groups.map((group, gi) => (
        <Panel key={group.localId} title={`Group ${gi + 1}`}>
          <Text style={styles.fieldLabel}>Application type</Text>
          <View style={styles.chips}>
            {APPLICATION_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.chip, group.applicationType === t ? styles.chipActive : null]}
                onPress={() => updateGroup(gi, { applicationType: t })}
              >
                <Text style={[styles.chipText, group.applicationType === t ? styles.chipTextActive : null]}>
                  {t.replace(/_/g, ' ')}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.fieldLabel}>Application day</Text>
          <View style={styles.chips}>
            {APPLICATION_DAYS.map((d) => (
              <Pressable
                key={d}
                style={[styles.chip, group.applicationDay === d ? styles.chipActive : null]}
                onPress={() => updateGroup(gi, { applicationDay: d })}
              >
                <Text style={[styles.chipText, group.applicationDay === d ? styles.chipTextActive : null]}>
                  Day {d}
                </Text>
              </Pressable>
            ))}
          </View>
          {group.materials.map((mat, mi) => (
            <View key={mat.localId} style={styles.materialBox}>
              <Text style={styles.materialTitle}>Material {mi + 1}</Text>
              <Text style={styles.fieldLabel}>Linked issue</Text>
              <View style={styles.chips}>
                {issueOptions.map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[styles.chip, mat.issueLocalId === opt.id ? styles.chipActive : null]}
                    onPress={() => updateMaterial(gi, mi, { issueLocalId: opt.id })}
                  >
                    <Text style={[styles.chipText, mat.issueLocalId === opt.id ? styles.chipTextActive : null]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Product / material name"
                value={mat.technicalName}
                onChangeText={(v) => updateMaterial(gi, mi, { technicalName: v })}
              />
              <Text style={styles.fieldLabel}>Dose</Text>
              <TextInput
                style={styles.input}
                placeholder="Quantity (e.g. 2, 500)"
                value={mat.doseQuantity ?? ''}
                onChangeText={(v) => updateMaterial(gi, mi, { doseQuantity: v })}
                keyboardType="decimal-pad"
              />
              <DynamicSelect
                label="Dose per"
                placeholder="Select basis"
                value={mat.doseBasis ?? ''}
                options={doseBasisOptions}
                onChange={(value) => updateMaterial(gi, mi, { doseBasis: value as typeof mat.doseBasis })}
              />
              <DynamicSelect
                label="Qty unit"
                placeholder="Select unit"
                value={mat.doseUnit ?? ''}
                options={doseUnitOptions}
                onChange={(value) => updateMaterial(gi, mi, { doseUnit: value as typeof mat.doseUnit })}
              />
              <DynamicSelect
                label="Application mode"
                placeholder="Select mode"
                value={mat.applicationMode ?? ''}
                options={applicationModeOptions}
                onChange={(value) =>
                  updateMaterial(gi, mi, { applicationMode: value as typeof mat.applicationMode })
                }
              />
            </View>
          ))}
          <Btn label="Add material" variant="secondary" onPress={() => addMaterial(gi)} />
        </Panel>
      ))}
      <Btn label="Add recommendation group" onPress={addGroup} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  intro: { fontSize: 13, color: tokens.textMuted, lineHeight: 18, paddingHorizontal: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: tokens.textMuted, marginTop: 8, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: tokens.bg,
  },
  chipActive: { borderColor: tokens.green700, backgroundColor: tokens.green100 },
  chipText: { fontSize: 12, color: tokens.text },
  chipTextActive: { color: tokens.green800, fontWeight: '700' },
  materialBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    gap: 4,
  },
  materialTitle: { fontSize: 13, fontWeight: '700', color: tokens.text },
  input: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: tokens.text,
    backgroundColor: tokens.card,
  },
});

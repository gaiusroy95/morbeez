import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { tokens, type RecommendationGroupDraft } from '@morbeez/shared';
import { Btn, Panel } from '@morbeez/ui-native';
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

export function VisitRecPlanningStep({ issues, groups, onChange }: Props) {
  const issueOptions = useMemo(
    () => issues.map((i) => ({ id: i.localId, label: i.issueName })),
    [issues]
  );

  function addGroup() {
    const issueLocalId = issues[0]?.localId ?? '';
    onChange([
      ...groups,
      {
        localId: newLocalId('grp'),
        applicationType: 'foliar_spray',
        applicationDay: 0,
        sortOrder: groups.length,
        materials: issueLocalId
          ? [
              {
                localId: newLocalId('mat'),
                issueLocalId,
                category: 'fungicide',
                technicalName: '',
                dose: '',
                method: 'foliar spray',
              },
            ]
          : [],
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
      materials: [
        ...g.materials,
        {
          localId: newLocalId('mat'),
          issueLocalId,
          category: 'fungicide',
          technicalName: '',
          dose: '',
          method: '',
        },
      ],
    });
  }

  function updateMaterial(groupIndex: number, matIndex: number, patch: Partial<RecommendationGroupDraft['materials'][number]>) {
    const g = groups[groupIndex];
    if (!g) return;
    updateGroup(groupIndex, {
      materials: g.materials.map((m, i) => (i === matIndex ? { ...m, ...patch } : m)),
    });
  }

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>Plan recommendation groups with application day, materials, dose, and method.</Text>
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
              <TextInput
                style={styles.input}
                placeholder="Product / technical name"
                value={mat.technicalName}
                onChangeText={(v) => updateMaterial(gi, mi, { technicalName: v })}
              />
              <TextInput
                style={styles.input}
                placeholder="Dose (e.g. 2 ml/L)"
                value={mat.dose ?? ''}
                onChangeText={(v) => updateMaterial(gi, mi, { dose: v })}
              />
              <TextInput
                style={styles.input}
                placeholder="Method"
                value={mat.method ?? ''}
                onChangeText={(v) => updateMaterial(gi, mi, { method: v })}
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
    gap: 6,
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

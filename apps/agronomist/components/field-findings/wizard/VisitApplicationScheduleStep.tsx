import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens, type RecommendationGroupDraft } from '@morbeez/shared';
import { Btn } from '@morbeez/ui-native';

const DAY_PRESETS = [0, 7, 14, 21];

type Props = {
  groups: RecommendationGroupDraft[];
  onChange: (groups: RecommendationGroupDraft[]) => void;
};

export function VisitApplicationScheduleStep({ groups, onChange }: Props) {
  function setDay(index: number, day: number) {
    const next = [...groups];
    const group = next[index];
    if (!group) return;
    next[index] = { ...group, applicationDay: day, sortOrder: day };
    onChange(next.sort((a, b) => a.applicationDay - b.applicationDay));
  }

  return (
    <View style={styles.root}>
      <Text style={styles.hint}>Assign application days for each recommendation group.</Text>
      {groups.map((group, index) => (
        <View key={group.localId} style={styles.card}>
          <Text style={styles.title}>
            {group.applicationType || 'Group'} — Day {group.applicationDay}
          </Text>
          <View style={styles.row}>
            {DAY_PRESETS.map((day) => (
              <Pressable
                key={day}
                style={[styles.chip, group.applicationDay === day && styles.chipActive]}
                onPress={() => setDay(index, day)}
              >
                <Text style={styles.chipText}>Day {day}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      <Btn
        label="+ Day 7 group"
        variant="secondary"
        onPress={() =>
          onChange([
            ...groups,
            {
              localId: `sched-${Date.now()}`,
              applicationType: 'Spray',
              applicationDay: 7,
              sortOrder: 7,
              materials: [],
            },
          ])
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  hint: { fontSize: 13, color: tokens.textMuted },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    gap: 8,
  },
  title: { fontSize: 15, fontWeight: '700', color: tokens.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipActive: { borderColor: tokens.green700, backgroundColor: tokens.green100 },
  chipText: { fontSize: 12, color: tokens.text },
});

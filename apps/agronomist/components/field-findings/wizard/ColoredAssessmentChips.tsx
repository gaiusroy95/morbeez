import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';

type Option<T extends string> = {
  value: T;
  label: string;
  tone: 'good' | 'average' | 'bad';
};

type Props<T extends string> = {
  options: Option<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
};

const toneStyles = {
  good: { bg: '#E8F5E9', border: tokens.green500, text: tokens.green800 },
  average: { bg: '#FFF8E1', border: '#F9A825', text: '#E65100' },
  bad: { bg: '#FFEBEE', border: '#E53935', text: '#B71C1C' },
};

export function ColoredAssessmentChips<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = value === o.value;
        const tone = toneStyles[o.tone];
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[
              styles.chip,
              { backgroundColor: tone.bg, borderColor: tone.border },
              active && styles.chipActive,
            ]}
          >
            <Text style={[styles.chipText, { color: tone.text }, active && styles.chipTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: tokens.radiusSm,
    borderWidth: 2,
    alignItems: 'center',
  },
  chipActive: { borderWidth: 2.5 },
  chipText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  chipTextActive: { fontWeight: '800' },
});

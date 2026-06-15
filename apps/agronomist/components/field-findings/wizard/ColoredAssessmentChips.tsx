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
  /** 2 for even grids (e.g. four soil options); defaults to 3. */
  columns?: 2 | 3;
};

const GAP = 8;

const toneStyles = {
  good: {
    bg: '#E8F5E9',
    border: '#A5D6A7',
    text: tokens.green800,
    activeBg: tokens.green700,
    activeBorder: tokens.green700,
    activeText: '#FFFFFF',
  },
  average: {
    bg: '#FFF8E1',
    border: '#FFE082',
    text: '#E65100',
    activeBg: '#F9A825',
    activeBorder: '#F9A825',
    activeText: '#FFFFFF',
  },
  bad: {
    bg: '#FFEBEE',
    border: '#EF9A9A',
    text: '#B71C1C',
    activeBg: '#E53935',
    activeBorder: '#E53935',
    activeText: '#FFFFFF',
  },
};

export function ColoredAssessmentChips<T extends string>({
  options,
  value,
  onChange,
  columns: columnsProp,
}: Props<T>) {
  const columns: 2 | 3 = columnsProp ?? (options.length === 4 ? 2 : 3);
  const chipWidth = columns === 2 ? '48%' : '31%';

  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = value === o.value;
        const tone = toneStyles[o.tone];
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.chip,
              { width: chipWidth },
              active ? styles.chipSelected : styles.chipDefault,
              {
                backgroundColor: active ? tone.activeBg : tone.bg,
                borderColor: active ? tone.activeBorder : tone.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Text
              numberOfLines={2}
              style={[
                styles.chipText,
                active ? styles.chipTextSelected : styles.chipTextDefault,
                { color: active ? tone.activeText : tone.text },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'flex-start',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusSm,
    minHeight: 44,
    paddingHorizontal: 6,
  },
  chipDefault: {
    paddingVertical: 10,
    borderWidth: 1,
  },
  chipSelected: {
    paddingVertical: 10,
    borderWidth: 2,
  },
  chipText: { textAlign: 'center' },
  chipTextDefault: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  chipTextSelected: { fontSize: 13, fontWeight: '800', lineHeight: 17 },
});

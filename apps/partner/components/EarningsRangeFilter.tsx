import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@morbeez/shared';
import { TextField } from '@morbeez/ui-native';
import {
  formatRangeLabel,
  isValidIsoDate,
  rangeForPreset,
  type EarningsDateRange,
  type EarningsRangePreset,
} from '@/lib/earnings-date-range';

const PRESETS: Array<{ id: EarningsRangePreset; label: string }> = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_3_months', label: 'Last 3 months' },
  { id: 'custom', label: 'Custom' },
];

type Props = {
  range: EarningsDateRange;
  onChange: (range: EarningsDateRange) => void;
  title?: string;
};

export function EarningsRangeFilter({ range, onChange, title }: Props) {
  const [open, setOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<EarningsRangePreset>(range.preset);
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);
  const [error, setError] = useState('');

  function applyPreset(preset: EarningsRangePreset) {
    setDraftPreset(preset);
    setError('');
    if (preset === 'custom') return;
    onChange(rangeForPreset(preset));
    setOpen(false);
  }

  function applyCustom() {
    if (!isValidIsoDate(customFrom) || !isValidIsoDate(customTo)) {
      setError('Use dates as YYYY-MM-DD.');
      return;
    }
    if (customFrom > customTo) {
      setError('Start date must be before end date.');
      return;
    }
    setError('');
    onChange({ preset: 'custom', from: customFrom, to: customTo });
    setOpen(false);
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Pressable
          onPress={() => {
            setDraftPreset(range.preset);
            setCustomFrom(range.from);
            setCustomTo(range.to);
            setError('');
            setOpen((v) => !v);
          }}
          style={styles.trigger}
          accessibilityRole="button"
          accessibilityLabel="Filter earnings by date range"
        >
          <Text style={styles.triggerText}>{formatRangeLabel(range.from, range.to)}</Text>
          <Text style={styles.triggerCaret}>{open ? '▴' : '▾'}</Text>
        </Pressable>
      </View>

      {open ? (
        <View style={styles.sheet}>
          <View style={styles.chips}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => applyPreset(p.id)}
                style={[styles.chip, draftPreset === p.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, draftPreset === p.id && styles.chipTextActive]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          {draftPreset === 'custom' ? (
            <>
              <TextField
                label="From (YYYY-MM-DD)"
                value={customFrom}
                onChangeText={setCustomFrom}
                placeholder="2026-06-01"
              />
              <TextField
                label="To (YYYY-MM-DD)"
                value={customTo}
                onChangeText={setCustomTo}
                placeholder="2026-06-30"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable onPress={applyCustom} style={styles.applyBtn}>
                <Text style={styles.applyText}>Apply range</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.green500,
    backgroundColor: tokens.green100,
  },
  triggerText: { fontSize: 12, fontWeight: '600', color: tokens.green800 },
  triggerCaret: { fontSize: 10, color: tokens.green800 },
  sheet: {
    marginTop: 10,
    padding: 12,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bg,
    gap: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  },
  chipActive: { backgroundColor: tokens.green100, borderColor: tokens.green500 },
  chipText: { fontSize: 13, color: tokens.textMuted },
  chipTextActive: { color: tokens.green800, fontWeight: '600' },
  error: { fontSize: 12, color: tokens.danger },
  applyBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: tokens.radiusSm,
    backgroundColor: tokens.green700,
  },
  applyText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

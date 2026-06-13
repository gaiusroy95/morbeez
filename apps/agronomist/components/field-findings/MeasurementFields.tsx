import { StyleSheet, Text, View } from 'react-native';
import { tokens, type MeasurementTemplate } from '@morbeez/shared';
import { Panel, TextField } from '@morbeez/ui-native';
import { SegmentedChips } from './SegmentedChips';

type Props = {
  templates: MeasurementTemplate[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

export function MeasurementFields({ templates, values, onChange }: Props) {
  if (!templates.length) return null;

  return (
    <Panel title="Measurements">
      {templates.map((tpl) => (
        <View key={tpl.measurementKey} style={styles.field}>
          {tpl.inputType === 'select' && Array.isArray(tpl.options) && tpl.options.length ? (
            <>
              <Text style={styles.label}>
                {tpl.labelEn}
                {tpl.required ? ' *' : ''}
              </Text>
              <SegmentedChips
                options={(tpl.options as string[]).map((o) => ({ value: o, label: o }))}
                value={values[tpl.measurementKey] ?? null}
                onChange={(v) => onChange(tpl.measurementKey, v)}
              />
            </>
          ) : (
            <TextField
              label={`${tpl.labelEn}${tpl.unit ? ` (${tpl.unit})` : ''}${tpl.required ? ' *' : ''}`}
              value={values[tpl.measurementKey] ?? ''}
              onChangeText={(v) => onChange(tpl.measurementKey, v)}
              keyboardType={tpl.inputType === 'number' ? 'numeric' : 'default'}
            />
          )}
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 8 },
});

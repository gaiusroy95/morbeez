import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tokens, type MeasurementTemplate } from '@morbeez/shared';
import { Panel } from '@morbeez/ui-native';
import { MeasurementFields } from '../MeasurementFields';

type Props = {
  cropType: string;
  templates: MeasurementTemplate[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

const GROUP_ORDER = ['Disease', 'Pest', 'Crop', 'Field', 'Other'] as const;

function measurementGroup(tpl: MeasurementTemplate): (typeof GROUP_ORDER)[number] {
  const key = `${tpl.measurementKey} ${tpl.labelEn}`.toLowerCase();
  if (/disease|incidence|severity|blight|rust|wilt/.test(key)) return 'Disease';
  if (/pest|insect|thrip|mite|count|trap/.test(key)) return 'Pest';
  if (/weed|moisture|soil|ph|ec/.test(key)) return 'Field';
  if (/height|stage|tiller|leaf|canopy|growth|dap/.test(key)) return 'Crop';
  return 'Other';
}

export function VisitMeasurementsStep({ cropType, templates, values, onChange }: Props) {
  const label = cropType.replace(/_/g, ' ');
  const grouped = useMemo(() => {
    const map = new Map<string, MeasurementTemplate[]>();
    for (const tpl of templates) {
      const group = measurementGroup(tpl);
      const list = map.get(group) ?? [];
      list.push(tpl);
      map.set(group, list);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, templates: map.get(g)! }));
  }, [templates]);

  return (
    <View style={styles.root}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Measurements are grouped by category for the {label} template.</Text>
      </View>
      {templates.length ? (
        grouped.map(({ group, templates: groupTemplates }) => (
          <Panel key={group} title={`${group} measurements`}>
            <MeasurementFields templates={groupTemplates} values={values} onChange={onChange} />
          </Panel>
        ))
      ) : (
        <Panel title="Measurements">
          <Text style={styles.empty}>No measurement template for this crop. Continue to soil & weather.</Text>
        </Panel>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  banner: {
    backgroundColor: '#E3F2FD',
    borderRadius: tokens.radiusSm,
    padding: 12,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  bannerText: { fontSize: 13, color: '#1565C0', lineHeight: 18 },
  empty: { fontSize: 14, color: tokens.textMuted },
});

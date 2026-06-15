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

export function VisitMeasurementsStep({ cropType, templates, values, onChange }: Props) {
  const label = cropType.replace(/_/g, ' ');

  return (
    <View style={styles.root}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Measurements are based on the {label} template.</Text>
      </View>
      {templates.length ? (
        <MeasurementFields templates={templates} values={values} onChange={onChange} />
      ) : (
        <Panel title="Measurements">
          <Text style={styles.empty}>No measurement template for this crop. Continue to issues.</Text>
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

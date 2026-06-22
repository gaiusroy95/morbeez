import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MeasurementTemplate } from '@morbeez/shared';
import { tokens } from '@morbeez/shared';
import { ScrollableUnderlineTabs } from '@morbeez/ui-native';
import { VisitMeasurementsStep } from './VisitMeasurementsStep';
import { VisitSoilWeatherStep } from './VisitSoilWeatherStep';

type Tab = 'measurements' | 'soil' | 'weather';

type Props = {
  cropType: string;
  farmerId: string;
  blockId: string;
  templates: MeasurementTemplate[];
  measurements: Record<string, string>;
  onMeasurementChange: (key: string, value: string) => void;
};

export function VisitFieldIntelligenceStep({
  cropType,
  farmerId,
  blockId,
  templates,
  measurements,
  onMeasurementChange,
}: Props) {
  const [tab, setTab] = useState<Tab>('measurements');

  return (
    <View style={styles.root}>
      <Text style={styles.intro}>
        Plot measurements, soil lab values, and weather context — review before AI diagnosis.
      </Text>
      <ScrollableUnderlineTabs
        tabs={[
          { id: 'measurements', label: 'Measures' },
          { id: 'soil', label: 'Soil' },
          { id: 'weather', label: 'Weather' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as Tab)}
      />
      {tab === 'measurements' ? (
        <VisitMeasurementsStep
          cropType={cropType}
          templates={templates}
          values={measurements}
          onChange={onMeasurementChange}
        />
      ) : null}
      {tab === 'soil' ? <VisitSoilWeatherStep farmerId={farmerId} blockId={blockId} soilOnly /> : null}
      {tab === 'weather' ? <VisitSoilWeatherStep farmerId={farmerId} blockId={blockId} weatherOnly /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  intro: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
});

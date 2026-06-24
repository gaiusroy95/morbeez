import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { MeasurementTemplate } from '@morbeez/shared';
import { agronomistClient, tokens } from '@morbeez/shared';
import { ScrollableUnderlineTabs } from '@morbeez/ui-native';
import { VisitMeasurementsStep } from './VisitMeasurementsStep';
import { VisitSoilWeatherStep } from './VisitSoilWeatherStep';

type Tab = 'measurements' | 'soil' | 'weather' | 'activity';

type ActivityRow = {
  id?: string;
  product_name?: string;
  method?: string;
  dose?: string;
  applied_at?: string;
};

type Props = {
  cropType: string;
  farmerId: string;
  blockId: string;
  templates: MeasurementTemplate[];
  measurements: Record<string, string>;
  onMeasurementChange: (key: string, value: string) => void;
};

function VisitFieldActivityTab({ farmerId, blockId }: { farmerId: string; blockId: string }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void agronomistClient
      .getFarmerApplicationHistory(farmerId, blockId)
      .then((r) => setRows(r.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [farmerId, blockId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={tokens.green700} />
        <Text style={styles.hint}>Loading recent applications…</Text>
      </View>
    );
  }

  if (!rows.length) {
    return (
      <Text style={styles.hint}>
        No spray, drench, or fertigation records in the last 30 days for this plot.
      </Text>
    );
  }

  return (
    <View style={styles.activityList}>
      <Text style={styles.hint}>Last applications on this block — used for resistance tracking.</Text>
      {rows.slice(0, 20).map((r, i) => (
        <View key={String(r.id ?? i)} style={styles.activityRow}>
          <Text style={styles.activityDate}>{String(r.applied_at ?? '').slice(0, 10)}</Text>
          <Text style={styles.activityProduct}>{String(r.product_name ?? '—')}</Text>
          <Text style={styles.activityMeta}>
            {String(r.method ?? '—')} · {String(r.dose ?? '—')}
          </Text>
        </View>
      ))}
    </View>
  );
}

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
        Plot measurements, soil lab values, weather context, and recent applications before AI diagnosis.
      </Text>
      <ScrollableUnderlineTabs
        tabs={[
          { id: 'measurements', label: 'Measures' },
          { id: 'soil', label: 'Soil' },
          { id: 'weather', label: 'Weather' },
          { id: 'activity', label: 'Activity' },
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
      {tab === 'activity' ? <VisitFieldActivityTab farmerId={farmerId} blockId={blockId} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  intro: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  center: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  activityList: { gap: 8 },
  activityRow: {
    padding: 10,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  },
  activityDate: { fontSize: 12, color: tokens.textMuted },
  activityProduct: { fontSize: 14, fontWeight: '600', color: tokens.text, marginTop: 2 },
  activityMeta: { fontSize: 12, color: tokens.textMuted, marginTop: 2 },
});

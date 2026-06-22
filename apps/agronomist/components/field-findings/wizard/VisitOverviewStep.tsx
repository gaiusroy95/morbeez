import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatDate,
  tokens,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type PortalSoilReport,
  type SoilMoistureLevel,
  type VisitClassification,
  type VisitFarmContext,
} from '@morbeez/shared';
import { Panel } from '@morbeez/ui-native';
import { ColoredAssessmentChips } from './ColoredAssessmentChips';
import { SegmentedChips } from '../SegmentedChips';

type Props = {
  farmerName: string;
  blockName: string;
  cropType: string;
  dap?: number | null;
  stage?: string | null;
  agronomistName?: string | null;
  soilTest?: PortalSoilReport | null;
  farmContext?: VisitFarmContext | null;
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
  onBlockHealth: (v: BlockHealthLevel) => void;
  onCropPerformance: (v: CropPerformanceLevel) => void;
  onSoilMoisture: (v: SoilMoistureLevel) => void;
  visitClassification?: VisitClassification;
  onVisitClassification?: (v: VisitClassification) => void;
  plotIntelSummary?: string | null;
};

const VISIT_TYPES = [
  { value: 'first' as const, label: 'First visit' },
  { value: 'follow_up' as const, label: 'Follow-up' },
  { value: 'rectification' as const, label: 'Rectification' },
];

const BLOCK_HEALTH = [
  { value: 'good' as const, label: 'Good', tone: 'good' as const },
  { value: 'average' as const, label: 'Average', tone: 'average' as const },
  { value: 'need_assistance' as const, label: 'Needs attention', tone: 'bad' as const },
];

const CROP_PERF = [
  { value: 'above_expectation' as const, label: 'Above expected', tone: 'good' as const },
  { value: 'as_expected' as const, label: 'As expected', tone: 'average' as const },
  { value: 'below_expectation' as const, label: 'Below expected', tone: 'bad' as const },
];

const SOIL_MOISTURE = [
  { value: 'dry' as const, label: 'Dry', tone: 'bad' as const },
  { value: 'optimal' as const, label: 'Optimal', tone: 'good' as const },
  { value: 'wet' as const, label: 'Wet', tone: 'average' as const },
  { value: 'waterlogged' as const, label: 'Waterlogged', tone: 'bad' as const },
];

function OverviewRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const valueNode = (
    <Text style={[styles.rowValue, onPress ? styles.rowLink : null]}>{value}</Text>
  );

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="link" style={styles.rowValueWrap}>
          {valueNode}
        </Pressable>
      ) : (
        valueNode
      )}
    </View>
  );
}

function soilMetricRows(soilTest: PortalSoilReport) {
  if (soilTest.metrics?.length) return soilTest.metrics.slice(0, 6);
  return soilTest.highlights.map((h, index) => {
    const [label, ...rest] = h.split(':');
    return { label: label?.trim() || `Value ${index + 1}`, value: rest.join(':').trim() || h };
  });
}

function SoilTestRows({ soilTest }: { soilTest: PortalSoilReport | null | undefined }) {
  if (!soilTest) {
    return (
      <>
        <OverviewRow label="Soil test date" value="—" />
        <OverviewRow label="Soil test status" value="None on file" />
      </>
    );
  }

  const metrics = soilMetricRows(soilTest);

  return (
    <>
      <OverviewRow label="Soil test date" value={soilTest.dateLabel} />
      <OverviewRow label="Soil test status" value={soilTest.healthLabel} />
      {soilTest.dapLabel ? <OverviewRow label="DAP at test" value={soilTest.dapLabel} /> : null}
      {metrics.length ? (
        metrics.map((metric) => (
          <OverviewRow key={`${metric.label}-${metric.value}`} label={metric.label} value={metric.value} />
        ))
      ) : (
        <OverviewRow label="Lab values" value="Report on file — no values entered" />
      )}
      {soilTest.pdfUrl ? (
        <OverviewRow
          label="Soil report"
          value="View PDF"
          onPress={() => void Linking.openURL(soilTest.pdfUrl!)}
        />
      ) : null}
    </>
  );
}

export function VisitOverviewStep({
  farmerName,
  blockName,
  cropType,
  dap,
  stage,
  agronomistName,
  soilTest,
  farmContext,
  blockHealth,
  cropPerformance,
  soilMoisture,
  onBlockHealth,
  onCropPerformance,
  onSoilMoisture,
  visitClassification,
  onVisitClassification,
  plotIntelSummary,
}: Props) {
  const assessmentsComplete = Boolean(blockHealth && cropPerformance && soilMoisture);
  const ctx = farmContext ?? null;

  return (
    <View style={styles.root}>
      <Panel title="Farm details">
        <OverviewRow label="Farmer" value={farmerName} />
        <OverviewRow label="Phone" value={ctx?.farmerPhone ?? '—'} />
        <OverviewRow label="Village" value={ctx?.village ?? '—'} />
        <OverviewRow label="District" value={ctx?.district ?? '—'} />
        <OverviewRow label="Block" value={blockName} />
        <OverviewRow label="Crop" value={cropType.replace(/_/g, ' ')} />
        <OverviewRow label="Variety" value={ctx?.varietyName ?? '—'} />
        <OverviewRow
          label="Area"
          value={
            ctx?.acreage != null
              ? `${ctx.acreage} ac`
              : ctx?.area?.trim()
                ? ctx.area
                : '—'
          }
        />
        <OverviewRow label="Irrigation" value={ctx?.irrigationType?.replace(/_/g, ' ') ?? '—'} />
        <OverviewRow label="Planting date" value={ctx?.plantingDate ?? '—'} />
        <OverviewRow label="Expected harvest" value={ctx?.expectedHarvestDate ?? '—'} />
      </Panel>

      <Panel title="Field assessment">
        <OverviewRow label="Visit date" value={formatDate(new Date().toISOString())} />
        <OverviewRow label="DAP" value={dap != null ? String(dap) : '—'} />
        <OverviewRow label="Stage" value={stage ?? '—'} />
        <OverviewRow label="Agronomist" value={agronomistName ?? '—'} />
        <SoilTestRows soilTest={soilTest} />
      </Panel>

      {onVisitClassification && visitClassification ? (
        <Panel title="Visit type">
          <SegmentedChips
            options={VISIT_TYPES}
            value={visitClassification}
            onChange={onVisitClassification}
          />
        </Panel>
      ) : null}

      {plotIntelSummary ? (
        <Panel title="Plot intelligence">
          <Text style={styles.plotIntel}>{plotIntelSummary}</Text>
        </Panel>
      ) : null}

      {ctx?.recentVisits?.length || ctx?.recentRecommendations?.length || ctx?.recentApplications?.length ? (
        <Panel title="Previous history">
          {ctx.recentVisits?.length ? (
            <>
              <Text style={styles.historyHeading}>Recent visits</Text>
              {ctx.recentVisits.map((v) => (
                <Text key={v.id} style={styles.historyItem}>
                  {v.dateLabel} · {v.summary}
                </Text>
              ))}
            </>
          ) : null}
          {ctx.recentRecommendations?.length ? (
            <>
              <Text style={styles.historyHeading}>Recent recommendations</Text>
              {ctx.recentRecommendations.map((r) => (
                <Text key={r.id} style={styles.historyItem}>
                  {r.dateLabel} · {r.title} ({r.status})
                </Text>
              ))}
            </>
          ) : null}
          {ctx.recentApplications?.length ? (
            <>
              <Text style={styles.historyHeading}>Recent applications</Text>
              {ctx.recentApplications.map((a) => (
                <Text key={a.id} style={styles.historyItem}>
                  {a.dateLabel} · {a.label}
                </Text>
              ))}
            </>
          ) : null}
        </Panel>
      ) : null}

      {!assessmentsComplete ? (
        <Text style={styles.hint}>Select block health, crop performance, and soil moisture. You can continue now and finish before submit.</Text>
      ) : null}

      <Panel title="Block health">
        <ColoredAssessmentChips options={BLOCK_HEALTH} value={blockHealth} onChange={onBlockHealth} />
      </Panel>

      <Panel title="Crop performance">
        <ColoredAssessmentChips options={CROP_PERF} value={cropPerformance} onChange={onCropPerformance} />
      </Panel>

      <Panel title="Soil moisture">
        <ColoredAssessmentChips columns={2} options={SOIL_MOISTURE} value={soilMoisture} onChange={onSoilMoisture} />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  hint: {
    fontSize: 13,
    color: tokens.textMuted,
    lineHeight: 18,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  rowLabel: { fontSize: 14, color: tokens.textMuted },
  rowValueWrap: { flex: 1, marginLeft: 12, alignItems: 'flex-end' },
  rowValue: { fontSize: 14, fontWeight: '600', color: tokens.text, flex: 1, textAlign: 'right', marginLeft: 12 },
  rowLink: { color: tokens.green700 },
  historyHeading: { fontSize: 12, fontWeight: '700', color: tokens.textMuted, marginTop: 8, marginBottom: 4 },
  historyItem: { fontSize: 13, color: tokens.text, lineHeight: 18, marginBottom: 4 },
  plotIntel: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
});

import { StyleSheet, Text, View } from 'react-native';
import { formatDate, tokens, type BlockHealthLevel, type CropPerformanceLevel, type SoilMoistureLevel } from '@morbeez/shared';
import { Panel } from '@morbeez/ui-native';
import { ColoredAssessmentChips } from './ColoredAssessmentChips';

type Props = {
  farmerName: string;
  blockName: string;
  cropType: string;
  dap?: number | null;
  stage?: string | null;
  agronomistName?: string | null;
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
  onBlockHealth: (v: BlockHealthLevel) => void;
  onCropPerformance: (v: CropPerformanceLevel) => void;
  onSoilMoisture: (v: SoilMoistureLevel) => void;
};

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

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function VisitOverviewStep({
  farmerName,
  blockName,
  cropType,
  dap,
  stage,
  agronomistName,
  blockHealth,
  cropPerformance,
  soilMoisture,
  onBlockHealth,
  onCropPerformance,
  onSoilMoisture,
}: Props) {
  const assessmentsComplete = Boolean(blockHealth && cropPerformance && soilMoisture);

  return (
    <View style={styles.root}>
      <Panel title="Block health">
        <ColoredAssessmentChips options={BLOCK_HEALTH} value={blockHealth} onChange={onBlockHealth} />
      </Panel>

      <Panel title="Crop performance">
        <ColoredAssessmentChips options={CROP_PERF} value={cropPerformance} onChange={onCropPerformance} />
      </Panel>

      <Panel title="Soil moisture">
        <ColoredAssessmentChips options={SOIL_MOISTURE} value={soilMoisture} onChange={onSoilMoisture} />
      </Panel>

      {!assessmentsComplete ? (
        <Text style={styles.hint}>Select all three assessments above. You can continue to photos now and finish before submit.</Text>
      ) : null}

      <Panel title="Visit overview">
        <OverviewRow label="Crop" value={cropType.replace(/_/g, ' ')} />
        <OverviewRow label="Block" value={blockName} />
        <OverviewRow label="Visit date" value={formatDate(new Date().toISOString())} />
        <OverviewRow label="DAP" value={dap != null ? String(dap) : '—'} />
        <OverviewRow label="Stage" value={stage ?? '—'} />
        <OverviewRow label="Agronomist" value={agronomistName ?? '—'} />
        <OverviewRow label="Farmer" value={farmerName} />
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  hint: { fontSize: 13, color: tokens.textMuted, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border,
  },
  rowLabel: { fontSize: 14, color: tokens.textMuted },
  rowValue: { fontSize: 14, fontWeight: '600', color: tokens.text, flex: 1, textAlign: 'right', marginLeft: 12 },
});

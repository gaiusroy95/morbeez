import { StyleSheet, Text, View } from 'react-native';
import {
  BLOCK_HEALTH_LEVELS,
  CROP_PERFORMANCE_LEVELS,
  SOIL_MOISTURE_LEVELS,
  tokens,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type SoilMoistureLevel,
} from '@morbeez/shared';
import { Panel } from '@morbeez/ui-native';
import { SegmentedChips } from './SegmentedChips';

const BLOCK_HEALTH_LABELS: Record<BlockHealthLevel, string> = {
  good: 'Good',
  average: 'Average',
  need_assistance: 'Needs help',
};

const PERFORMANCE_LABELS: Record<CropPerformanceLevel, string> = {
  above_expectation: 'Above',
  as_expected: 'As expected',
  below_expectation: 'Below',
};

const MOISTURE_LABELS: Record<SoilMoistureLevel, string> = {
  dry: 'Dry',
  optimal: 'Optimal',
  wet: 'Wet',
  waterlogged: 'Waterlogged',
};

type Props = {
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
  onBlockHealth: (v: BlockHealthLevel) => void;
  onCropPerformance: (v: CropPerformanceLevel) => void;
  onSoilMoisture: (v: SoilMoistureLevel) => void;
};

export function BlockAssessmentSection({
  blockHealth,
  cropPerformance,
  soilMoisture,
  onBlockHealth,
  onCropPerformance,
  onSoilMoisture,
}: Props) {
  return (
    <Panel title="Block assessment">
      <View style={styles.field}>
        <Text style={styles.label}>Block health</Text>
        <SegmentedChips
          options={BLOCK_HEALTH_LEVELS.map((v) => ({ value: v, label: BLOCK_HEALTH_LABELS[v] }))}
          value={blockHealth}
          onChange={onBlockHealth}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Crop performance</Text>
        <SegmentedChips
          options={CROP_PERFORMANCE_LEVELS.map((v) => ({ value: v, label: PERFORMANCE_LABELS[v] }))}
          value={cropPerformance}
          onChange={onCropPerformance}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Soil moisture</Text>
        <SegmentedChips
          options={SOIL_MOISTURE_LEVELS.map((v) => ({ value: v, label: MOISTURE_LABELS[v] }))}
          value={soilMoisture}
          onChange={onSoilMoisture}
        />
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: tokens.text, marginBottom: 8 },
});

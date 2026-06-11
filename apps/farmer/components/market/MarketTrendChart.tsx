import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { tokens } from '@morbeez/shared';

export type MarketTrendPoint = { value: number; label?: string };

const CHART_HEIGHT = 196;
const Y_AXIS_WIDTH = 42;
const HORIZONTAL_INSET = 48;

function niceChartMax(values: number[]) {
  if (!values.length) return 100;
  const peak = Math.max(...values, 1);
  const padded = peak * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function chartSpacing(pointCount: number, chartWidth: number) {
  if (pointCount <= 1) return chartWidth * 0.4;
  const usable = Math.max(chartWidth - 28, 120);
  return Math.min(Math.max(usable / (pointCount - 1), 18), 56);
}

export function MarketTrendChart({
  current,
  previous,
  chartKey,
  showLegend = false,
  currentLabel = 'This year',
  previousLabel = 'Last year',
}: {
  current: MarketTrendPoint[];
  previous?: MarketTrendPoint[];
  chartKey?: string;
  showLegend?: boolean;
  currentLabel?: string;
  previousLabel?: string;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(0);

  const chartWidth = Math.max((layoutWidth || screenWidth - HORIZONTAL_INSET) - Y_AXIS_WIDTH, 160);
  const pointCount = Math.max(current.length, previous?.length ?? 0);
  const dense = pointCount > 10;
  const scrollable = pointCount > 8;

  const allValues = useMemo(
    () => [...current, ...(previous ?? [])].map((p) => p.value),
    [current, previous]
  );
  const maxValue = useMemo(() => niceChartMax(allValues), [allValues]);
  const spacing = chartSpacing(pointCount, chartWidth);

  const pointerConfig = useMemo(
    () => ({
      activatePointersOnLongPress: true,
      pointerStripUptoDataPoint: true,
      pointerStripColor: tokens.border,
      pointerStripWidth: 1,
      strokeDashArray: [4, 4],
      pointerColor: tokens.green700,
      radius: 5,
      pointerLabelWidth: 96,
      pointerLabelHeight: 36,
      autoAdjustPointerLabelPosition: true,
      pointerLabelComponent: (items: Array<{ value?: number; label?: string }>) => {
        const item = items[0];
        if (!item?.value && item?.value !== 0) return null;
        return (
          <View style={styles.pointerLabel}>
            <Text style={styles.pointerValue}>₹{Math.round(item.value)}</Text>
            {item.label ? <Text style={styles.pointerMeta}>{item.label}</Text> : null}
          </View>
        );
      },
    }),
    []
  );

  if (!current.length) return null;

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const next = e.nativeEvent.layout.width;
        if (next > 0 && Math.abs(next - layoutWidth) > 1) setLayoutWidth(next);
      }}
    >
      <LineChart
        key={chartKey ?? `${pointCount}-${chartWidth}`}
        data={current}
        data2={previous?.length ? previous : undefined}
        width={scrollable ? spacing * Math.max(pointCount - 1, 1) + 36 : chartWidth}
        height={CHART_HEIGHT}
        maxValue={maxValue}
        noOfSections={4}
        spacing={spacing}
        initialSpacing={14}
        endSpacing={14}
        curved
        areaChart={!dense}
        startFillColor={tokens.green500}
        endFillColor={tokens.green100}
        startOpacity={0.22}
        endOpacity={0.02}
        color={tokens.green700}
        color2="#94a89a"
        thickness={2.5}
        thickness2={2}
        strokeDashArray2={[7, 5]}
        hideDataPoints={dense}
        hideDataPoints2={dense}
        dataPointsColor={tokens.green700}
        dataPointsColor2="#94a89a"
        dataPointsRadius={4}
        dataPointsRadius2={3}
        focusEnabled
        showStripOnFocus
        showDataPointOnFocus
        unFocusOnPressOut
        pointerConfig={pointerConfig}
        rulesType="dashed"
        rulesColor={tokens.border}
        dashWidth={4}
        dashGap={6}
        xAxisColor={tokens.border}
        yAxisColor="transparent"
        yAxisLabelWidth={Y_AXIS_WIDTH}
        yAxisLabelPrefix="₹"
        yAxisTextStyle={styles.axisText}
        xAxisLabelTextStyle={styles.axisText}
        backgroundColor={tokens.bg}
        isAnimated
        animationDuration={700}
        disableScroll={!scrollable}
        adjustToWidth={!scrollable}
        scrollToEnd={scrollable}
        showScrollIndicator={scrollable}
      />

      {showLegend ? (
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendSwatchCurrent]} />
            <Text style={styles.legendCurrent}>{currentLabel}</Text>
          </View>
          {previous?.length ? (
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.legendSwatchPrevious]} />
              <Text style={styles.legendPrev}>{previousLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: tokens.radiusSm,
    overflow: 'hidden',
    backgroundColor: tokens.bg,
    paddingTop: 4,
    paddingBottom: 2,
  },
  axisText: { color: tokens.textMuted, fontSize: 10, fontWeight: '500' },
  legendRow: { flexDirection: 'row', gap: 18, marginTop: 10, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 16, height: 3, borderRadius: 999 },
  legendSwatchCurrent: { backgroundColor: tokens.green700 },
  legendSwatchPrevious: { backgroundColor: '#94a89a' },
  legendCurrent: { fontSize: 12, color: tokens.green700, fontWeight: '600' },
  legendPrev: { fontSize: 12, color: tokens.textMuted, fontWeight: '600' },
  pointerLabel: {
    backgroundColor: tokens.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pointerValue: { fontSize: 12, fontWeight: '700', color: tokens.green800 },
  pointerMeta: { fontSize: 10, color: tokens.textMuted, marginTop: 1 },
});

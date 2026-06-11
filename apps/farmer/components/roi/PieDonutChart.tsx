import { View, StyleSheet, Text } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { tokens } from '@morbeez/shared';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function PieDonutChart({
  segments,
  size = 160,
  centerLabel,
  centerValue,
  formatValue,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  formatValue?: (n: number) => string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR * 0.55;
  let angle = 0;

  const paths = segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const sweep = (seg.value / total) * 360;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      const outer = arcPath(cx, cy, outerR, start, end);
      const inner = arcPath(cx, cy, innerR, end, start);
      return {
        ...seg,
        d: `${outer} L ${polarToCartesian(cx, cy, innerR, start).x} ${polarToCartesian(cx, cy, innerR, start).y} ${inner} Z`,
        pct: Math.round((seg.value / total) * 100),
      };
    });

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G>
            {paths.map((p) => (
              <Path key={p.label} d={p.d} fill={p.color} />
            ))}
          </G>
        </Svg>
        {centerValue ? (
          <View style={[styles.center, { width: size, height: size }]}>
            {centerLabel ? <Text style={styles.centerLabel}>{centerLabel}</Text> : null}
            <Text style={styles.centerValue}>{centerValue}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.legend}>
        {paths.map((p) => (
          <View key={p.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: p.color }]} />
            <Text style={styles.legendText}>
              {p.label} · {formatValue ? formatValue(p.value) : p.value} ({p.pct}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 8 },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: { fontSize: 10, color: tokens.textMuted },
  centerValue: { fontSize: 14, fontWeight: '800', color: tokens.text },
  legend: { alignSelf: 'stretch', marginTop: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, color: tokens.text, flex: 1 },
});

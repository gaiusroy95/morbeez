import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDate, tokens, type AgronomistBlockRow } from '@morbeez/shared';
import { HealthBadge } from '@morbeez/ui-native';

type Props = {
  block: AgronomistBlockRow;
  farmerName?: string;
  onPress?: () => void;
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label} </Text>
      <Text style={styles.metaValue}>{value}</Text>
    </Text>
  );
}

export function AgronomistBlockCard({ block, onPress }: Props) {
  const subtitle = [block.cropType, block.plotLabel].filter(Boolean).join(' · ');
  const lastVisit =
    block.lastVisitAt != null
      ? [
          formatDate(block.lastVisitAt),
          block.lastVisitDap != null ? `DAP ${block.lastVisitDap}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : '—';
  const soilTest = block.latestSoilTestAt ? formatDate(block.latestSoilTestAt) : 'No soil test';
  const fieldActivity = block.latestFieldActivity?.trim() || 'No field activity logged';

  const content = (
    <View style={[styles.card, block.needsAttention && styles.cardAttention]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{block.name}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {block.needsAttention ? (
          <HealthBadge status="alert" label="Needs attention" />
        ) : null}
      </View>

      <View style={styles.badgeRow}>
        <HealthBadge
          status={block.cropHealthStatus ?? 'monitor'}
          label={`Crop: ${block.cropHealthLabel ?? '—'}`}
        />
        <HealthBadge
          status={block.soilHealthStatus ?? 'stable'}
          label={`Soil: ${block.soilHealthLabel ?? 'Good'}`}
        />
      </View>

      <MetaRow label="Last visit:" value={lastVisit} />
      <MetaRow label="Current DAP:" value={block.dap != null ? String(block.dap) : '—'} />
      <MetaRow
        label="Open issues:"
        value={block.openIssueCount != null ? String(block.openIssueCount) : '0'}
      />
      {block.blockHealth ? <MetaRow label="Block health:" value={block.blockHealth} /> : null}
      <MetaRow label="Field activity:" value={fieldActivity} />
      <MetaRow label="Soil test:" value={soilTest} />
      {block.latestFindingLabel ? (
        <View style={styles.findingWrap}>
          <Text style={styles.findingLabel}>Latest finding</Text>
          <Text style={styles.findingText} numberOfLines={2}>
            {block.latestFindingLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.card,
    borderWidth: 1,
    borderColor: tokens.border,
    borderRadius: tokens.radius,
    padding: 14,
    marginBottom: 10,
  },
  cardAttention: {
    borderColor: tokens.danger,
    backgroundColor: '#FFF8F8',
  },
  pressed: { opacity: 0.92 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  titleWrap: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: tokens.text },
  subtitle: { fontSize: 13, color: tokens.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  metaRow: { fontSize: 13, lineHeight: 20, marginBottom: 2 },
  metaLabel: { color: tokens.textMuted, fontWeight: '600' },
  metaValue: { color: tokens.text },
  findingWrap: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: tokens.border,
  },
  findingLabel: { fontSize: 12, fontWeight: '600', color: tokens.textMuted, marginBottom: 4 },
  findingText: { fontSize: 13, color: tokens.text, lineHeight: 18 },
});

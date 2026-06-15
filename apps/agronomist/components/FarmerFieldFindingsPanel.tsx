import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  agronomistClient,
  formatDate,
  tokens,
  type AgronomistBlockRow,
  type AgronomistWorkspaceSummary,
  type FarmerFieldFindingRow,
  type FieldFindingStatusFilter,
} from '@morbeez/shared';
import { AlertBox, Btn, Loading } from '@morbeez/ui-native';
import { SegmentedChips } from '@/components/field-findings/SegmentedChips';

const STATUS_FILTERS = [
  { value: 'all' as const, label: 'All' },
  { value: 'open' as const, label: 'Open' },
  { value: 'monitoring' as const, label: 'Monitoring' },
  { value: 'resolved' as const, label: 'Resolved' },
];

type Props = {
  farmerId: string;
  summary: AgronomistWorkspaceSummary;
  onStartVisit: () => void;
};

function healthLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/_/g, ' ');
}

export function FarmerFieldFindingsPanel({ farmerId, summary, onStartVisit }: Props) {
  const router = useRouter();
  const [findings, setFindings] = useState<FarmerFieldFindingRow[]>([]);
  const [blocks, setBlocks] = useState<AgronomistBlockRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<FieldFindingStatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const primaryBlock = blocks[0] ?? null;
  const cropLabel = summary.activeCrops[0] ?? primaryBlock?.cropType?.replace(/_/g, ' ') ?? '—';
  const locationLine = [summary.farmer.district].filter(Boolean).join(' · ') || '—';
  const dap = primaryBlock?.dap ?? summary.dap;
  const stage = primaryBlock?.cropHealthLabel ?? '—';
  const acreage = primaryBlock?.acreage ?? summary.farmer.acreage;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, farmerBlocks] = await Promise.all([
        agronomistClient.listFarmerVisits(farmerId, {
          limit: 50,
          status: statusFilter === 'all' ? undefined : statusFilter,
        }),
        agronomistClient.getFarmerBlocks(farmerId).catch(() => [] as AgronomistBlockRow[]),
      ]);
      setFindings(rows);
      setBlocks(farmerBlocks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load field findings');
      setFindings([]);
    } finally {
      setLoading(false);
    }
  }, [farmerId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const emptyLabel = useMemo(() => {
    if (statusFilter === 'all') return 'No visits recorded yet.';
    return `No ${statusFilter} findings.`;
  }, [statusFilter]);

  if (loading && !findings.length && !blocks.length) {
    return <Loading label="Loading field findings…" />;
  }

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{summary.farmer.name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{summary.farmer.name}</Text>
            <Text style={styles.heroMeta}>{locationLine}</Text>
            {summary.farmer.phone ? <Text style={styles.heroPhone}>{summary.farmer.phone}</Text> : null}
          </View>
        </View>
      </View>

      {primaryBlock ? (
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="grid-outline" size={18} color={tokens.green700} />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>{primaryBlock.name}</Text>
              <Text style={styles.infoSub}>
                {[acreage != null ? `${acreage} acres` : primaryBlock.area, primaryBlock.plotLabel]
                  .filter(Boolean)
                  .join(' · ') || 'Field block'}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Crop</Text>
              <Text style={styles.statusValue}>{cropLabel}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>DAP</Text>
              <Text style={styles.statusValue}>{dap != null ? String(dap) : '—'}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Stage</Text>
              <Text style={styles.statusValue} numberOfLines={1}>
                {stage}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <Btn label="Start new visit" onPress={onStartVisit} />

      <SegmentedChips options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />

      <Text style={styles.sectionTitle}>Previous visits</Text>
      <View style={styles.list}>
        {findings.map((item) => {
          const topIssues =
            item.topIssueNames?.length ? item.topIssueNames.join(', ') : item.summary || 'Field visit';
          const health = healthLabel(item.blockHealth);
          return (
            <Pressable key={item.id} style={styles.visitCard} onPress={() => router.push(`/visit/${item.id}`)}>
              <View style={styles.visitHeader}>
                <Text style={styles.visitBlock}>{item.blockName}</Text>
                <Text style={styles.visitDate}>{formatDate(item.visitedAt)}</Text>
              </View>
              <Text style={styles.visitIssues} numberOfLines={1}>
                {topIssues}
              </Text>
              <Text style={styles.visitMeta}>
                {[
                  item.cropType?.replace(/_/g, ' '),
                  item.dapAtVisit != null ? `DAP ${item.dapAtVisit}` : null,
                  `${item.issueCount} issue${item.issueCount === 1 ? '' : 's'}`,
                  health,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Pressable>
          );
        })}
        {!findings.length && !loading ? <Text style={styles.empty}>{emptyLabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12, paddingBottom: 8 },
  heroCard: {
    backgroundColor: tokens.green800,
    borderRadius: tokens.radiusSm,
    padding: 16,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#fff' },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  heroMeta: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  heroPhone: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 4, fontWeight: '600' },
  infoCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: tokens.text },
  infoSub: { fontSize: 13, color: tokens.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: tokens.border, marginVertical: 12 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusItem: { flex: 1 },
  statusLabel: { fontSize: 11, color: tokens.textMuted, textTransform: 'uppercase', fontWeight: '600' },
  statusValue: { fontSize: 14, fontWeight: '700', color: tokens.text, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: tokens.text, marginTop: 4 },
  list: { gap: 8 },
  visitCard: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
  },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  visitBlock: { fontSize: 15, fontWeight: '700', color: tokens.text },
  visitDate: { fontSize: 12, color: tokens.textMuted },
  visitIssues: { fontSize: 14, color: tokens.text, marginBottom: 4 },
  visitMeta: { fontSize: 12, color: tokens.textMuted },
  empty: { padding: 24, color: tokens.textMuted, textAlign: 'center' },
});

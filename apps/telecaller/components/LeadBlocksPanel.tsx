import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, telecallerClient, tokens } from '@morbeez/shared';
import { AlertBox, HealthBadge, Loading, Panel } from '@morbeez/ui-native';

type Props = {
  leadId: string;
};

type BlockRow = {
  id: string;
  name: string;
  cropType?: string;
  dap?: number | null;
  openIssueCount?: number;
  lastVisitAt?: string | null;
  healthStatus?: string | null;
};

function BlockCard({ block, onPress }: { block: BlockRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.title}>{block.name}</Text>
      {block.cropType ? <Text style={styles.sub}>{block.cropType}</Text> : null}
      <View style={styles.meta}>
        {block.healthStatus ? <HealthBadge status="monitor" label={block.healthStatus} /> : null}
        {block.dap != null ? <Text style={styles.metaText}>DAP {block.dap}</Text> : null}
        {block.openIssueCount != null ? (
          <Text style={styles.metaText}>{block.openIssueCount} open issues</Text>
        ) : null}
      </View>
      {block.lastVisitAt ? (
        <Text style={styles.visit}>Last visit: {formatDate(block.lastVisitAt)}</Text>
      ) : null}
    </Pressable>
  );
}

export function LeadBlocksPanel({ leadId }: Props) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await telecallerClient.listLeadBlocks(leadId);
      setBlocks(
        raw.map((b) => ({
          id: String(b.id),
          name: String(b.name ?? b.plotLabel ?? 'Block'),
          cropType: b.cropType ? String(b.cropType) : b.crop_type ? String(b.crop_type) : undefined,
          dap: b.dap != null ? Number(b.dap) : null,
          openIssueCount: b.openIssueCount != null ? Number(b.openIssueCount) : undefined,
          lastVisitAt: b.lastVisitAt ? String(b.lastVisitAt) : b.last_visit_at ? String(b.last_visit_at) : null,
          healthStatus: b.blockHealth ? String(b.blockHealth) : b.healthStatus ? String(b.healthStatus) : null,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load blocks');
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading blocks…" />;

  return (
    <View style={styles.root}>
      {error ? <AlertBox>{error}</AlertBox> : null}
      <Panel title="Farm blocks">
        <Text style={styles.hint}>Tap a block to view activities, soil tests, findings, and recommendations.</Text>
      </Panel>
      {blocks.map((block) => (
        <BlockCard
          key={block.id}
          block={block}
          onPress={() => router.push(`/lead/${leadId}/block/${block.id}`)}
        />
      ))}
      {!blocks.length ? <Text style={styles.empty}>No blocks registered yet.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, paddingBottom: 24 },
  hint: { fontSize: 13, color: tokens.textMuted },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radius,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 14,
  },
  title: { fontSize: 16, fontWeight: '600', color: tokens.text },
  sub: { fontSize: 13, color: tokens.textMuted, marginTop: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
  metaText: { fontSize: 12, color: tokens.textMuted },
  visit: { fontSize: 12, color: tokens.textMuted, marginTop: 6 },
  empty: { textAlign: 'center', color: tokens.textMuted, padding: 24 },
});

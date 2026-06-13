import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatDate, partnerClient, tokens, type PartnerVisitRow } from '@morbeez/shared';
import { AlertBox, EmptyState, Loading, Panel } from '@morbeez/ui-native';

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function VisitSection({
  title,
  visits,
  onOpen,
}: {
  title: string;
  visits: PartnerVisitRow[];
  onOpen: (visit: PartnerVisitRow) => void;
}) {
  if (!visits.length) return null;
  return (
    <Panel title={title}>
      {visits.map((visit) => (
        <Pressable key={visit.id} style={styles.card} onPress={() => onOpen(visit)}>
          <Text style={styles.title}>{visit.farmerName ?? 'Farmer visit'}</Text>
          {visit.summary ? <Text style={styles.summary}>{visit.summary}</Text> : null}
          <Text style={styles.meta}>{formatDate(visit.visitedAt)}</Text>
        </Pressable>
      ))}
    </Panel>
  );
}

export default function VisitsScreen() {
  const router = useRouter();
  const [visits, setVisits] = useState<PartnerVisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const rows = await partnerClient.listVisits();
      setVisits(
        rows.map((v) => ({
          id: String(v.id),
          farmerId: String(v.farmerId),
          farmerName: v.farmerName ? String(v.farmerName) : undefined,
          blockId: v.blockId ? String(v.blockId) : null,
          visitedAt: String(v.visitedAt),
          summary: v.summary ? String(v.summary) : undefined,
          status: v.status ? String(v.status) : undefined,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load visits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { today, recent } = useMemo(() => {
    const todayRows: PartnerVisitRow[] = [];
    const recentRows: PartnerVisitRow[] = [];
    for (const visit of visits) {
      if (isToday(visit.visitedAt)) todayRows.push(visit);
      else recentRows.push(visit);
    }
    return { today: todayRows, recent: recentRows };
  }, [visits]);

  const openVisit = (visit: PartnerVisitRow) => {
    router.push(`/farmer/${visit.farmerId}`);
  };

  if (loading && !visits.length) return <Loading label="Loading visits…" />;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
      }
    >
      {error ? <AlertBox>{error}</AlertBox> : null}
      {!visits.length ? <EmptyState>No visits recorded yet.</EmptyState> : null}
      <VisitSection title="Today" visits={today} onOpen={openVisit} />
      <VisitSection title="Recent" visits={recent} onOpen={openVisit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.bg },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: tokens.card,
    borderRadius: tokens.radiusSm,
    borderWidth: 1,
    borderColor: tokens.border,
    padding: 12,
    marginBottom: 8,
  },
  title: { fontSize: 15, fontWeight: '600', color: tokens.text },
  summary: { fontSize: 13, color: tokens.textMuted, marginTop: 4 },
  meta: { fontSize: 12, color: tokens.textMuted, marginTop: 6 },
});
